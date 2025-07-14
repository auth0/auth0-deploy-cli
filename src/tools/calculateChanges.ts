import { Client } from 'auth0';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import log from '../logger';
import APIHandler from './auth0/handlers/default';
import { Asset, Assets, Auth0APIClient, CalculatedChanges } from '../types';
import { convertClientNameToId } from './utils';
import { paginate } from './auth0/client';
import { decodeBase64ToCertString } from '../utils';

/**
 * @template T
 * @param {typeof import('./auth0/handlers/default').default} handler
 * @param {T} desiredAssetState
 * @param {T} currentAssetState
 * @param {string[]} [objectFields=[]]
 * @param {boolean} [allowDelete]
 * @returns T
 */
export function processChangedObjectFields({
  handler,
  desiredAssetState,
  currentAssetState,
  allowDelete,
}: {
  handler: APIHandler;
  desiredAssetState: Asset;
  currentAssetState: Asset;
  allowDelete: boolean;
}) {
  const desiredAssetStateWithChanges = { ...desiredAssetState };

  // eslint-disable-next-line no-restricted-syntax
  for (const fieldName of handler.objectFields) {
    const areDesiredStateAndCurrentStateEmpty =
      Object.keys(desiredAssetState[fieldName] || {}).length === 0 &&
      Object.keys(currentAssetState[fieldName] || {}).length === 0;
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
        for (const currentObjectFieldPropertyName of Object.keys(currentAssetState[fieldName])) {
          // Loop through each object property that exists currently
          if (desiredAssetState[fieldName][currentObjectFieldPropertyName] === undefined) {
            // If the object has a property that exists now but doesn't exist in the proposed state
            if (allowDelete) {
              desiredAssetStateWithChanges[fieldName][currentObjectFieldPropertyName] = null;
            } else {
              // If deletes aren't allowed, do outright delete the property within the object
              log.warn(
                `Detected that the ${fieldName} of the following ${
                  handler.name || handler.id || ''
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
        `Detected that the ${fieldName} of the following ${
          handler.name || handler.id || ''
        } should be emptied. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config\n${handler.objString(
          currentAssetState
        )}`
      );
    }
  }

  return desiredAssetStateWithChanges;
}

export function calculateChanges({
  handler,
  assets,
  existing,
  identifiers = ['id', 'name'],
  allowDelete,
}: {
  handler: APIHandler;
  assets: Asset[];
  existing: Asset[] | null;
  identifiers: string[];
  allowDelete: boolean;
}): CalculatedChanges {
  // Calculate the changes required between two sets of assets.
  const update: Asset[] = [];
  let del: Asset[] = [...(existing || [])];
  let create: Asset[] = [...assets];
  const conflicts: Asset[] = [];

  const findByKeyValue = (key: string, value: string, arr: Asset[]): Asset | undefined =>
    arr.find((e) => {
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

        return asset[id] as string;
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
                  handler,
                  desiredAssetState: asset,
                  currentAssetState: found,
                  allowDelete,
                })
              : asset),
          });
        }
      }
    });
  };

  // Loop through identifiers (in order) to try match assets to existing
  // If existing then update if not create
  // The remainder will be deleted
  identifiers.forEach((id) => {
    processAssets(id, [...create]);
  });

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
        const conflict = (existing || []).filter(
          (e) => e.name === a.name && e[uniqueID] !== a[uniqueID]
        )[0];
        if (conflict) {
          const temp = Math.random().toString(36).substr(2, 5);
          conflicts.push({
            ...conflict,
            name: `${conflict.name}-${temp}`,
          });
        }
      }
    });
  }

  return {
    del,
    update,
    conflicts,
    create,
  };
}

const logStore: Record<string, string[]> = {};
const diffLog = (resourceTypeName: string, message: string[]): void => {
  if (!logStore[resourceTypeName]) {
    logStore[resourceTypeName] = [];
  }
  logStore[resourceTypeName].push(...message);
};

const getDiffLog = (resourceTypeName?: string): string[] | { [key: string]: string[] } =>
  resourceTypeName ? logStore[resourceTypeName] || [] : logStore;

export const exportDiffLog = async (fileName: string, resourceTypeName?: string) => {
  const diffLogData = getDiffLog(resourceTypeName);
  try {
    await fs.writeFile(`./${fileName}`, JSON.stringify(diffLogData, null, 2));
  } catch (error) {
    log.error(`Failed to export diff log: ${String(error)}`);
  }
};

/**
 * Compares two objects and returns an array of differences found.
 * Only considers keys that exist in obj1 - extra keys in obj2 are ignored.
 * @param localObj - The first object (preferred values)
 * @param remoteObj - The second object to compare against
 * @param keyObjPath - The current JSON path for nested object tracking
 * @param resourceTypeName - The resource type name for logging
 * @returns Array of difference descriptions, empty array if no differences
 */

export function getObjectDifferences(
  localObj: Record<string, any>,
  remoteObj: Record<string, any>,
  keyObjPath: string = '',
  resourceTypeName: string = ''
): string[] {
  const differences: string[] = [];

  Object.keys(localObj).forEach((key) => {
    const localValue = localObj[key];
    const remoteValue = remoteObj[key];
    const currentPath = keyObjPath ? `${keyObjPath}.${key}` : key;

    // If key doesn't exist in remoteObj, there's a difference
    if (!(key in remoteObj)) {
      const message = `Key [${currentPath}] found in 'localObj' but not in 'remoteObj'.`;
      log.debug(
        `[${chalk.blue(resourceTypeName)}] Key ${chalk.yellow(
          `"${currentPath}"`
        )} found in 'localObj' but not in 'remoteObj'.`
      );
      differences.push(message);
      return;
    }

    // Handle arrays
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      if (localValue.length !== remoteValue.length) {
        const message = `Array length difference for [${currentPath}]: local:${localValue.length} vs remote:${remoteValue.length}`;
        log.debug(
          `[${chalk.blue(resourceTypeName)}] Array length difference for ${chalk.yellow(
            `"${currentPath}"`
          )}: local:${localValue.length} vs remote:${remoteValue.length}`
        );
        differences.push(message);
      }

      // For arrays with objects, compare in order; for primitive arrays, ignore order
      const hasObjects = localValue.some((item) => typeof item === 'object' && item !== null);

      if (hasObjects) {
        localValue.forEach((item, index) => {
          if (
            typeof item === 'object' &&
            item !== null &&
            typeof remoteValue[index] === 'object' &&
            remoteValue[index] !== null
          ) {
            const nestedDifferences = getObjectDifferences(
              item,
              remoteValue[index],
              `${currentPath}[${index}]`,
              resourceTypeName
            );
            differences.push(...nestedDifferences);
          } else if (item !== remoteValue[index]) {
            const message = `Array item difference at [${currentPath}[${index}]]: local:${item} vs remote:${remoteValue[index]}`;
            differences.push(message);
          }
        });
      } else {
        // Compare primitive arrays ignoring order
        const sorted1 = [...localValue].sort();
        const sorted2 = [...remoteValue].sort();
        const isDifferent = sorted1.some((item, index) => item !== sorted2[index]);

        if (isDifferent) {
          const message = `Array content difference found for key [${currentPath}]`;
          log.debug(
            `[${chalk.blue(
              resourceTypeName
            )}] Array content difference found for key ${chalk.yellow(`"${currentPath}"`)}`
          );
          differences.push(message);
        }
      }
      return;
    }

    // Handle nested objects
    if (
      typeof localValue === 'object' &&
      localValue !== null &&
      typeof remoteValue === 'object' &&
      remoteValue !== null
    ) {
      const nestedDifferences = getObjectDifferences(
        localValue,
        remoteValue,
        currentPath,
        resourceTypeName
      );
      differences.push(...nestedDifferences);
      return;
    }

    // Compare primitive values
    if (localValue !== remoteValue) {
      const message = `Value difference for [${currentPath}]: local:${localValue} vs remote:${remoteValue}`;
      log.debug(
        `[${chalk.blue(resourceTypeName)}] Value difference for ${chalk.yellow(
          `"${currentPath}"`
        )}: local:${localValue} vs remote:${remoteValue}`
      );
      differences.push(message);
    }
  });

  return differences;
}

/**
 * Compares two objects and returns true if there are differences.
 * Only considers keys that exist in obj1 - extra keys in obj2 are ignored.
 * @param obj1 - The first object (preferred values)
 * @param obj2 - The second object to compare against
 * @param keyObjPath - The current JSON path for nested object tracking
 * @returns true if objects differ, false if they are the same
 */

export function hasObjectDifferences(
  localObj: Record<string, any>,
  remoteObj: Record<string, any>,
  keyObjPath: string = '',
  resourceTypeName: string = ''
): boolean {
  const differences = getObjectDifferences(localObj, remoteObj, keyObjPath, resourceTypeName);
  diffLog(resourceTypeName, differences);
  return differences.length > 0;
}

/**
 * Calculates the changes required between local and remote asset sets for dry run operations.
 *
 * This function compares local assets with existing remote assets to determine what operations
 * need to be performed: create new assets, update existing ones, or delete removed assets.
 * Assets are matched using configurable identifier fields.
 *
 * @param params - The configuration object for calculating changes
 * @param params.type - The type of assets being compared (used for logging)
 * @param params.assets - Array of local assets to be deployed
 * @param params.existing - Array of existing remote assets, or null if none exist
 * @param params.identifiers - Array of field names or field name arrays used to match assets between local and remote sets. Default is ['id', 'name']
 *
 */
export function calculateDryRunChanges({
  type,
  assets,
  existing,
  identifiers = ['id', 'name'],
}: {
  type: string;
  assets: Asset[] | Asset;
  existing: Asset[] | Asset | null;
  identifiers: string[];
}): CalculatedChanges {
  // Calculate the changes required between two sets of assets.
  const update: Asset[] = [];
  const del: Asset[] = [];
  const create: Asset[] = [];
  const conflicts: Asset[] = [];

  const localAssets: Asset[] = Array.isArray(assets) ? [...assets] : [assets]; // Local assets (what we have locally)
  const remoteAssets: Asset[] = Array.isArray(existing) ? [...existing] : [existing]; // Remote assets (what exists remotely)

  // identify created
  const createdAssets = localAssets.filter(
    (localAsset) =>
      !remoteAssets.some((remoteAsset) =>
        identifiers.some((id) => {
          if (Array.isArray(id)) {
            const localValues = id.map((i) => localAsset[i]);
            const remoteValues = id.map((i) => remoteAsset[i]);
            return (
              localValues.every((v) => v) &&
              remoteValues.every((v) => v) &&
              localValues.join('-') === remoteValues.join('-')
            );
          }
          return localAsset[id] === remoteAsset[id];
        })
      )
  );
  create.push(...createdAssets);

  // identify updated
  const updatedAssets = localAssets.filter((localAsset) => {
    const matchingRemoteAsset = remoteAssets.find((remoteAsset) =>
      identifiers.some((id) => {
        if (Array.isArray(id)) {
          const localValues = id.map((i) => localAsset[i]);
          const remoteValues = id.map((i) => remoteAsset[i]);
          return (
            localValues.every((v) => v !== undefined && v !== null) &&
            remoteValues.every((v) => v !== undefined && v !== null) &&
            localValues.join('-') === remoteValues.join('-')
          );
        }
        return (
          localAsset[id] !== undefined &&
          remoteAsset[id] !== undefined &&
          localAsset[id] === remoteAsset[id]
        );
      })
    );

    if (matchingRemoteAsset) {
      // Add missing identifiers from remote asset to local asset
      identifiers.forEach((id) => {
        if (Array.isArray(id)) {
          // Handle array identifiers - ensure all parts exist
          id.forEach((idPart) => {
            if (!localAsset[idPart] && matchingRemoteAsset[idPart]) {
              localAsset[idPart] = matchingRemoteAsset[idPart];
            }
          });
        } else if (!localAsset[id] && matchingRemoteAsset[id]) {
          // Handle single identifier
          localAsset[id] = matchingRemoteAsset[id];
        }
      });

      return hasObjectDifferences(
        localAsset,
        matchingRemoteAsset,
        matchingRemoteAsset.name ?? '',
        type
      );
    }

    // If no match found, check with hasObjectDifferences against all remote assets
    return remoteAssets.some((remoteAsset) =>
      hasObjectDifferences(localAsset, remoteAsset, remoteAsset.name ?? '', type)
    );
  });
  update.push(...updatedAssets);

  // identify deleted
  const deletedAssets = remoteAssets
    .filter(
      (remoteAsset) =>
        !localAssets.some((localAsset) =>
          identifiers.some((id) => {
            if (Array.isArray(id)) {
              const localValues = id.map((i) => localAsset[i]);
              const remoteValues = id.map((i) => remoteAsset[i]);
              return (
                localValues.every((v) => v) &&
                remoteValues.every((v) => v) &&
                localValues.join('-') === remoteValues.join('-')
              );
            }
            return localAsset[id] === remoteAsset[id];
          })
        )
    )
    .map((remoteAsset) => {
      // Add missing identifiers from remote asset for proper tracking
      const assetWithIdentifiers = { ...remoteAsset };
      identifiers.forEach((id) => {
        if (Array.isArray(id)) {
          // Handle array identifiers - ensure all parts exist
          id.forEach((idPart) => {
            if (remoteAsset[idPart]) {
              assetWithIdentifiers[idPart] = remoteAsset[idPart];
            }
          });
        } else if (remoteAsset[id]) {
          // Handle single identifier
          assetWithIdentifiers[id] = remoteAsset[id];
        }
      });
      return assetWithIdentifiers;
    });
  del.push(...deletedAssets);

  /*
  console.log(`Calculated changes for [${type}]:`, {
    del: del.length,
    create: create.length,
    conflicts: conflicts.length,
    update: update.length,
  });
  */

  log.debug(
    `[DryRun] calculated changes for [${type}]:${JSON.stringify({
      del: del.length,
      create: create.length,
      conflicts: conflicts.length,
      update: update.length,
    })}`
  );

  return {
    del,
    create,
    conflicts,
    update,
  };
}

/**
 * Performs a dry run formatting of assets for dry run compare.
 * - converting client names to client IDs or vice versa
 *
 * @param assets - The assets object containing databases and clients configurations
 * @param authAPIclient - The Auth0 API client instance used to fetch remote client data
 * @returns A Promise that resolves to the formatted assets object with client names converted to IDs
 */
export async function dryRunFormatAssets(
  localAssets: Assets,
  authAPIclient: Auth0APIClient
): Promise<Assets> {
  // get client remote data
  const clientsRemoteData = await paginate<Client>(authAPIclient.clients.getAll, {
    paginate: true,
    include_totals: true,
  });

  // check assets clientGrants and clients together and have values
  if (localAssets.clientGrants) {
    const { clientGrants } = localAssets;
    localAssets.clientGrants = clientGrants.map((clientGrant) => {
      if (clientGrant.client_id) {
        clientGrant.client_id = convertClientNameToId(clientGrant.client_id, clientsRemoteData);
      }
      return clientGrant;
    });
  }

  // check assets databases and clients together and have values
  if (localAssets.databases && localAssets.clients) {
    const { databases } = localAssets;
    localAssets.databases = databases.map((db) => {
      if (db.enabled_clients && db.enabled_clients.length > 0) {
        db.enabled_clients = db.enabled_clients.map((enabledClientName) =>
          convertClientNameToId(enabledClientName, clientsRemoteData)
        );
      }
      return db;
    });
  }

  // format assets actions
  if (localAssets.actions) {
    const { actions } = localAssets;
    localAssets.actions = actions.map((action) => {
      if ('deployed' in action) {
        action.all_changes_deployed = action.deployed;
        delete action.deployed;
      }
      return action;
    });
  }

  // format assets connections
  if (localAssets.connections) {
    const { connections } = localAssets;
    localAssets.connections = connections.map((connection) => {
      if (connection.strategy === 'samlp' && connection.options) {
        if ('cert' in connection.options) {
          connection.options.cert = decodeBase64ToCertString(connection.options.cert);
        }
      }
      if (localAssets.clients && connection.enabled_clients) {
        connection.enabled_clients = connection.enabled_clients.map((clientName) =>
          convertClientNameToId(clientName, clientsRemoteData)
        );
      }
      return connection;
    });
  }

  // format assets emailProvider
  if (localAssets.emailProvider) {
    const { emailProvider } = localAssets;

    if (emailProvider.name === 'smtp') {
      if (emailProvider.credentials && emailProvider.credentials.smtp_pass) {
        delete emailProvider.credentials.smtp_pass;
      }
    }

    localAssets.emailProvider = emailProvider;
  }

  return localAssets;
}
