import log from './logger';

/**
 * @template T
 * @param {typeof import('./auth0/handlers/default').default} handler
 * @param {T} desiredAssetState
 * @param {T} currentAssetState
 * @param {string[]} [objectFields=[]]
 * @param {boolean} [allowDelete=false]
 * @returns T
 */
export function processChangedObjectFields({
    handler, desiredAssetState, currentAssetState, allowDelete = false
}: {
    handler: Handler,
    desiredAssetState: Asset,
    currentAssetState: Asset,
    allowDelete?: boolean
}) {
    const desiredAssetStateWithChanges = { ...desiredAssetState };

    // eslint-disable-next-line no-restricted-syntax
    for (const fieldName of handler.objectFields) {
        const areDesiredStateAndCurrentStateEmpty = Object.keys(desiredAssetState[fieldName] || {}).length === 0 && Object.keys(currentAssetState[fieldName] || {}).length === 0;
        if (areDesiredStateAndCurrentStateEmpty) {
            // If both the desired state and current state for a given object is empty, it is a no-op and can skip
            // eslint-disable-next-line no-continue
            continue;
        }

        // A desired state that omits the objectField OR that has it as an empty object should
        // signal that all fields should be removed (subject to ALLOW_DELETE).
        if (desiredAssetState[fieldName] && Object.keys(desiredAssetState[fieldName]).length) {
            // Both the current and desired state have the object field. Here's where we need to map
            // to the APIv2 protocol of setting `null` values for deleted fields.
            // For new and modified properties of the object field, we can just pass them through to
            // APIv2.
            if (currentAssetState[fieldName]) {
                // eslint-disable-next-line no-restricted-syntax
                for (const currentObjectFieldPropertyName of Object.keys(
                    currentAssetState[fieldName]
                )) {
                    // Loop through each object property that exists currently
                    if (desiredAssetState[fieldName][currentObjectFieldPropertyName] === undefined) {
                        // If the object has a property that exists now but doesn't exist in the proposed state
                        if (allowDelete) {
                            desiredAssetStateWithChanges[fieldName][
                                currentObjectFieldPropertyName
                            ] = null;
                        } else {
                            // If deletes aren't allowed, do outright delete the property within the object
                            log.warn(
                                `Detected that the ${fieldName} of the following ${handler.name || handler.id || ''
                                } should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config\n${handler.objString(
                                    currentAssetState
                                )}`
                            );
                        }
                    }
                }
            }
        } else if (allowDelete) {
            // If the desired state does not have the object field and the current state does, we
            // should mark *all* properties for deletion by specifying an empty object.
            //
            // See: https://auth0.com/docs/users/metadata/manage-metadata-api#delete-user-metadata
            desiredAssetStateWithChanges[fieldName] = {};
        } else {
            delete desiredAssetStateWithChanges[fieldName];
            log.warn(
                `Detected that the ${fieldName} of the following ${handler.name || handler.id || ''
                } should be emptied. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config\n${handler.objString(
                    currentAssetState
                )}`
            );
        }
    }

    return desiredAssetStateWithChanges;
}

// Temporary type for Asset until more canonical types are created
type Asset = {
    [key: string]: { [key: string]: string } | string//Temporarily accounting for different types of assets with arbitrary properties
}

// Temporary type for Auth0 API handler until more canonical types are created
type Handler = {
    id: string
    name?: string
    objectFields: string[]
    objString: (arg0: Asset) => string
}


export function calculateChanges({ handler, assets, existing, identifiers = ['id', 'name'], allowDelete }: {
    handler: Handler,
    assets: Asset[],
    existing: Asset[],
    identifiers: string[],
    allowDelete: boolean,
}): {
    del: Asset[],
    update: Asset[],
    conflicts: Asset[],
    create: Asset[],
} {
    // Calculate the changes required between two sets of assets.
    const update: Asset[] = [];
    let del: Asset[] = [...existing];
    let create: Asset[] = [...assets];
    const conflicts: Asset[] = [];

    const findByKeyValue = (key: string, value: string, arr: Asset[]): Asset | undefined => arr.find((e) => {
        if (Array.isArray(key)) {
            const values = key.map((k) => e[k]);
            if (values.every((v) => v)) {
                return value === values.join('-');
            }
        }
        return e[key] === value;
    });

    const processAssets = (id: string, arr: Asset[]) => {
        arr.forEach((asset) => {
            const assetIdValue: string | undefined = (() => {
                if (Array.isArray(id)) {
                    const values = id.map((i) => asset[i]);
                    if (values.every((v) => v)) {
                        return values.join('-');
                    }
                }

                return asset[id] as string
            })();

            if (assetIdValue !== undefined) {
                const found = findByKeyValue(id, assetIdValue, del);
                if (found !== undefined) {
                    // Delete from existing
                    del = del.filter((e) => e !== found);

                    // Delete from create as it's an update
                    create = create.filter((e) => e !== asset);

                    // Append identifiers to asset
                    update.push({
                        ...identifiers.reduce((obj, i) => {
                            if (found[i]) obj[i] = found[i];
                            return obj;
                        }, {}),
                        // If we have any object fields, we need to make sure that they get
                        // special treatment. When different metadata objects are passed to APIv2
                        // properties must explicitly be marked for deletion by indicating a `null`
                        // value.
                        ...(handler.objectFields.length
                            ? processChangedObjectFields({
                                handler, desiredAssetState: asset, currentAssetState: found, allowDelete
                            })
                            : asset)
                    });
                }
            }
        });
    };

    // Loop through identifiers (in order) to try match assets to existing
    // If existing then update if not create
    // The remainder will be deleted
    for (const id of identifiers) { // eslint-disable-line
        processAssets(id, [...create]);
    }

    // Check if there are assets with names that will conflict with existing names during the update process
    // This will rename those assets to a temp random name first
    // This assumes the first identifiers is the unique identifier
    if (identifiers.includes('name')) {
        const uniqueID = identifiers[0];
        const futureAssets: Asset[] = [...create, ...update];
        futureAssets.forEach((a) => {
            // If the conflicting item is going to be deleted then skip
            const inDeleted = del.filter((e) => e.name === a.name && e[uniqueID] !== a[uniqueID])[0];
            if (!inDeleted) {
                const conflict = existing.filter((e) => e.name === a.name && e[uniqueID] !== a[uniqueID])[0];
                if (conflict) {
                    const temp = Math.random().toString(36).substr(2, 5);
                    conflicts.push({
                        ...conflict,
                        name: `${conflict.name}-${temp}`
                    });
                }
            }
        });
    }

    return {
        del,
        update,
        conflicts,
        create
    };
}