/**
 * Dry-run change calculation utilities.
 *
 * This module handles all logic specific to the --dry-run mode:
 * - Comparing local vs. remote assets to detect creates, updates, and deletes
 * - Normalizing asset representations (session durations, client name→ID, profiles)
 * - Tracking and exporting a structured diff log
 *
 * The core deploy-time change calculation lives in calculateChanges.ts.
 */

import { Management } from 'auth0';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import log from '../logger';
import { Asset, Assets, Auth0APIClient, CalculatedChanges } from '../types';
import { convertClientNameToId } from './utils';
import { paginate } from './auth0/client';
import sessionDurationsToMinutes from '../sessionDurationsToMinutes';

const clearTenantFlags = (tenant: Asset): void => {
  if (tenant.flags && !Object.keys(tenant.flags).length) {
    delete tenant.flags;
  }
};

/**
 * Converts tenant session duration fields from hours to minutes so that
 * local (hours) and remote (minutes) representations can be compared directly.
 */
const normalizeTenantForDryRun = (tenant: Asset): Asset => {
  const normalizedTenant = { ...tenant };

  clearTenantFlags(normalizedTenant);

  const sessionDurations = sessionDurationsToMinutes({
    session_lifetime: normalizedTenant.session_lifetime,
    idle_session_lifetime: normalizedTenant.idle_session_lifetime,
    ephemeral_session_lifetime: normalizedTenant.ephemeral_session_lifetime,
    idle_ephemeral_session_lifetime: normalizedTenant.idle_ephemeral_session_lifetime,
  });

  if (Object.keys(sessionDurations).length > 0) {
    delete normalizedTenant.session_lifetime;
    delete normalizedTenant.idle_session_lifetime;
    delete normalizedTenant.ephemeral_session_lifetime;
    delete normalizedTenant.idle_ephemeral_session_lifetime;
    Object.assign(normalizedTenant, sessionDurations);
  }

  return normalizedTenant;
};

const decodeBase64ToCertString = (base64Cert: string) => {
  try {
    return Buffer.from(base64Cert, 'base64').toString('utf-8');
  } catch (e) {
    return base64Cert;
  }
};

// In-memory store for diff log entries, keyed by resource type name.
const logStore: Record<string, string[]> = {};

const diffLog = (resourceTypeName: string, message: string[]): void => {
  if (!logStore[resourceTypeName]) {
    logStore[resourceTypeName] = [];
  }
  logStore[resourceTypeName].push(...message);
};

export const getDiffLog = (resourceTypeName?: string): string[] | { [key: string]: string[] } =>
  resourceTypeName ? logStore[resourceTypeName] || [] : logStore;

/**
 * Returns a human-readable label for an asset used as the keyObjPath prefix in diff messages.
 * Named resources (those with a `name` field) use the name directly.
 * Unnamed resources fall back to `${type}-${index + 1}` (1-based)
 */
function getAssetLabel(asset: Asset, type: string, index: number): string {
  return typeof asset.name === 'string' && asset.name.length > 0
    ? asset.name
    : `${type}-${index + 1}`;
}

function shouldIgnoreDryRunField(currentPath: string, ignoreDryRunFields: string[]): boolean {
  return ignoreDryRunFields.some(
    (field) =>
      currentPath === field ||
      currentPath.endsWith(`.${field}`) ||
      currentPath.endsWith(`[${field}]`)
  );
}

/**
 * Recursively normalizes an array so that order-insensitive comparisons can be
 * made. Objects within the array have their keys sorted; the array itself is
 * sorted by the JSON stringification of each element.
 */
function normalizeArrayValues(values: any[]): any[] {
  const normalizeValue = (value: any): any => {
    if (Array.isArray(value)) {
      return normalizeArrayValues(value);
    }

    if (typeof value === 'object' && value !== null) {
      return Object.keys(value)
        .sort()
        .reduce((normalized, key) => {
          normalized[key] = normalizeValue(value[key]);
          return normalized;
        }, {} as Record<string, any>);
    }

    return value;
  };

  return values
    .map((value) => normalizeValue(value))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

/**
 * Writes the accumulated diff log to a JSON file on disk.
 * Useful for CI pipelines that want a machine-readable dry-run report.
 */
export const exportDiffLog = async (fileName: string, resourceTypeName?: string) => {
  const diffLogData = getDiffLog(resourceTypeName);
  try {
    await fs.writeFile(`./${fileName}`, JSON.stringify(diffLogData, null, 2));
  } catch (error) {
    log.error(`Failed to export diff log: ${String(error)}`);
  }
};

/**
 * Compares two objects and returns an array of human-readable difference strings.
 * Only considers keys present in `localObj` — extra keys in `remoteObj` are ignored.
 *
 * @param localObj - Local (desired) state
 * @param remoteObj - Remote (current) state
 * @param keyObjPath - Dot-separated JSON path used for nested tracking
 * @param resourceTypeName - Resource type label used in log output
 * @param ignoreDryRunFields - Field paths to skip during comparison
 * @returns Array of difference descriptions, empty if objects are equivalent
 */
export function getObjectDifferences(
  localObj: Record<string, any>,
  remoteObj: Record<string, any>,
  keyObjPath: string = '',
  resourceTypeName: string = '',
  ignoreDryRunFields: string[] = []
): string[] {
  const differences: string[] = [];

  Object.keys(localObj).forEach((key) => {
    const localValue = localObj[key];
    const remoteValue = remoteObj[key];
    const currentPath = keyObjPath ? `${keyObjPath}.${key}` : key;

    if (shouldIgnoreDryRunField(currentPath, ignoreDryRunFields)) {
      log.debug(
        `[${chalk.blue(resourceTypeName)}] Ignoring key ${chalk.yellow(
          `"${currentPath}"`
        )} due to ignoreDryRunFields configuration.`
      );
      return;
    }

    // Key exists locally but not remotely
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

    // Handle arrays — normalize order before comparing
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      const normalizedLocalValue = normalizeArrayValues(localValue);

      // Strip extra keys from remote objects before sorting — extra remote keys shift sort order,
      // misaligning arrays and causing false "key in local but not in remote" differences.
      const localKeySet = new Set(
        localValue.flatMap((item) =>
          typeof item === 'object' && item !== null ? Object.keys(item) : []
        )
      );
      const remoteValueFiltered =
        localKeySet.size > 0
          ? remoteValue.map((item) =>
              typeof item === 'object' && item !== null
                ? Object.fromEntries(Object.entries(item).filter(([k]) => localKeySet.has(k)))
                : item
            )
          : remoteValue;
      const normalizedRemoteValue = normalizeArrayValues(remoteValueFiltered);

      if (normalizedLocalValue.length !== normalizedRemoteValue.length) {
        const message = `Array length difference for [${currentPath}]: local:${normalizedLocalValue.length} vs remote:${normalizedRemoteValue.length}`;
        log.debug(
          `[${chalk.blue(resourceTypeName)}] Array length difference for ${chalk.yellow(
            `"${currentPath}"`
          )}: local:${normalizedLocalValue.length} vs remote:${normalizedRemoteValue.length}`
        );
        differences.push(message);
      }

      const hasObjects = normalizedLocalValue.some(
        (item) => typeof item === 'object' && item !== null
      );

      if (hasObjects) {
        // Compare object arrays element-by-element (after normalization)
        normalizedLocalValue.forEach((item, index) => {
          if (
            typeof item === 'object' &&
            item !== null &&
            typeof normalizedRemoteValue[index] === 'object' &&
            normalizedRemoteValue[index] !== null
          ) {
            const nestedDifferences = getObjectDifferences(
              item,
              normalizedRemoteValue[index],
              `${currentPath}[${index}]`,
              resourceTypeName,
              ignoreDryRunFields
            );
            differences.push(...nestedDifferences);
          } else if (item !== normalizedRemoteValue[index]) {
            const message = `Array item difference at [${currentPath}[${index}]]: local:${item} vs remote:${normalizedRemoteValue[index]}`;
            differences.push(message);
          }
        });
      } else {
        // Primitive arrays: order-insensitive comparison
        const isDifferent = normalizedLocalValue.some(
          (item, index) => item !== normalizedRemoteValue[index]
        );

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
        resourceTypeName,
        ignoreDryRunFields
      );
      differences.push(...nestedDifferences);
      return;
    }

    // Compare primitive values — omit array indices from path to reduce log noise
    if (localValue !== remoteValue) {
      let arrayPathRegex = new RegExp(/\[\d+\]/g);
      if (!arrayPathRegex.test(currentPath)) {
        const message = `Value difference for [${currentPath}]: local:${localValue} vs remote:${remoteValue}`;
        differences.push(message);
      }
    }
  });

  return differences;
}

/**
 * Returns true if `localObj` and `remoteObj` differ in any field present in
 * `localObj`. Side-effect: appends found differences to the diff log.
 */
export function hasObjectDifferences(
  localObj: Record<string, any>,
  remoteObj: Record<string, any>,
  keyObjPath: string = '',
  resourceTypeName: string = '',
  ignoreDryRunFields: string[] = []
): boolean {
  const differences = getObjectDifferences(
    localObj,
    remoteObj,
    keyObjPath,
    resourceTypeName,
    ignoreDryRunFields
  );
  diffLog(resourceTypeName, differences);
  return differences.length > 0;
}

/**
 * Calculates the changes required between local and remote asset sets for dry-run operations.
 *
 * Unlike `calculateChanges`, this function does not mutate assets for API consumption.
 * It is purely for reporting: determining which assets would be created, updated, or deleted.
 *
 * @param params.type - Resource type label used for logging
 * @param params.assets - Local assets to be deployed
 * @param params.existing - Remote assets currently on the tenant, or null
 * @param params.identifiers - Fields used to match local↔remote assets (default: ['id', 'name'])
 * @param params.ignoreDryRunFields - Fields to exclude from diff comparisons
 */
export function calculateDryRunChanges({
  type,
  assets,
  existing,
  identifiers = ['id', 'name'],
  ignoreDryRunFields = [],
}: {
  type: string;
  assets: Asset[] | Asset;
  existing: Asset[] | Asset | null;
  identifiers: string[];
  ignoreDryRunFields: string[];
}): CalculatedChanges {
  const update: Asset[] = [];
  const del: Asset[] = [];
  const create: Asset[] = [];
  const conflicts: Asset[] = [];

  const localAssets: Asset[] = (Array.isArray(assets) ? [...assets] : [assets]).map((asset) =>
    type === 'tenant' ? normalizeTenantForDryRun(asset) : asset
  );
  const remoteAssets: Asset[] = (Array.isArray(existing) ? [...existing] : [existing]).map(
    (asset) => (type === 'tenant' ? normalizeTenantForDryRun(asset) : asset)
  );

  // Helper: returns true if a local and remote asset share at least one identifier value
  const assetsMatch = (localAsset: Asset, remoteAsset: Asset) =>
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
    });

  // Identify created: local assets with no matching remote asset
  const createdAssets = localAssets.filter(
    (localAsset) => !remoteAssets.some((remoteAsset) => assetsMatch(localAsset, remoteAsset))
  );
  create.push(...createdAssets);

  // Identify updated: local assets that match a remote asset and have differences
  const updatedAssets = localAssets.filter((localAsset, localAssetIndex) => {
    const matchingRemoteAsset = remoteAssets.find((remoteAsset) => {
      // Detect singleton resources (e.g. tenant) that carry none of the identifier fields on either
      // side.  For these, fall back to the lenient assetsMatch() used for CREATE/DELETE detection
      // so that value-only changes (e.g. a flag flip) are still surfaced as UPDATE.
      const isSingleton = identifiers.every((id) => {
        if (Array.isArray(id)) {
          return id.every((i) => localAsset[i] === undefined && remoteAsset[i] === undefined);
        }
        return localAsset[id] === undefined && remoteAsset[id] === undefined;
      });

      if (isSingleton) {
        return assetsMatch(localAsset, remoteAsset);
      }

      // Stricter match check: identifier values must be non-null on both sides
      return identifiers.some((id) => {
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
      });
    });

    if (matchingRemoteAsset) {
      // Backfill any identifier fields missing from the local asset (e.g. remote-assigned IDs)
      identifiers.forEach((id) => {
        if (Array.isArray(id)) {
          id.forEach((idPart) => {
            if (!localAsset[idPart] && matchingRemoteAsset[idPart]) {
              localAsset[idPart] = matchingRemoteAsset[idPart];
            }
          });
        } else if (!localAsset[id] && matchingRemoteAsset[id]) {
          localAsset[id] = matchingRemoteAsset[id];
        }
      });

      return hasObjectDifferences(
        localAsset,
        matchingRemoteAsset,
        getAssetLabel(localAsset, type, localAssetIndex),
        type,
        ignoreDryRunFields
      );
    }

    return false;
  });
  update.push(...updatedAssets);

  // Identify deleted: remote assets with no matching local asset
  const deletedAssets = remoteAssets
    .filter(
      (remoteAsset) => !localAssets.some((localAsset) => assetsMatch(localAsset, remoteAsset))
    )
    .map((remoteAsset) => {
      // Ensure all identifier fields are present on the returned asset for tracking
      const assetWithIdentifiers = { ...remoteAsset };
      identifiers.forEach((id) => {
        if (Array.isArray(id)) {
          id.forEach((idPart) => {
            if (remoteAsset[idPart]) {
              assetWithIdentifiers[idPart] = remoteAsset[idPart];
            }
          });
        } else if (remoteAsset[id]) {
          assetWithIdentifiers[id] = remoteAsset[id];
        }
      });
      return assetWithIdentifiers;
    });
  del.push(...deletedAssets);

  const hasChanges =
    del.length > 0 || create.length > 0 || conflicts.length > 0 || update.length > 0;

  if (hasChanges) {
    log.debug(
      `[DryRun] calculated changes for [${type}]:${JSON.stringify({
        create: create.length,
        update: update.length,
        del: del.length,
        conflicts: conflicts.length,
      })}`
    );
  }

  return { del, create, conflicts, update };
}

/**
 * Normalizes local assets so they can be accurately compared against remote assets.
 *
 * Transformations applied:
 * - Converts client name references to client IDs (clientGrants, databases, connections, resourceServers)
 * - Resolves connection profile and user attribute profile names to IDs (express_configuration)
 * - Decodes base64-encoded SAML certificates to PEM strings
 * - Resolves organization connection names to connection IDs
 * - Normalizes tenant session duration fields
 * - Removes empty branding templates (avoids false diff against remote)
 *
 * @param localAssets - Local assets object (will be mutated)
 * @param authAPIclient - Auth0 management API client for fetching remote reference data
 * @returns The mutated assets object with normalized values
 */
export async function dryRunFormatAssets(
  localAssets: Assets,
  authAPIclient: Auth0APIClient
): Promise<Assets> {
  const clientsRemoteData = await paginate<Management.Client>(authAPIclient.clients.list, {
    paginate: true,
    include_totals: true,
  });

  if (localAssets.clientGrants) {
    const { clientGrants } = localAssets;
    localAssets.clientGrants = clientGrants.map((clientGrant) => {
      if (clientGrant.client_id) {
        const originalName = clientGrant.client_id;
        const resolvedId = convertClientNameToId(originalName, clientsRemoteData);
        if (resolvedId !== originalName) {
          (clientGrant as Asset)._clientName = originalName;
        }
        clientGrant.client_id = resolvedId;
      }
      return clientGrant;
    });
  }

  if (localAssets.resourceServers) {
    localAssets.resourceServers = localAssets.resourceServers.map((resourceServer) => {
      if (resourceServer.client_id) {
        resourceServer.client_id = convertClientNameToId(
          resourceServer.client_id,
          clientsRemoteData
        );
      }
      return resourceServer;
    });
  }

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

  if (localAssets.clients?.some((client) => client.express_configuration)) {
    const [connectionProfiles, userAttributeProfiles] = await Promise.all([
      paginate<Asset>(authAPIclient.connectionProfiles.list, {
        checkpoint: true,
        take: 10,
      }),
      paginate<Asset>(authAPIclient.userAttributeProfiles.list, {
        checkpoint: true,
        include_totals: true,
        is_global: false,
        take: 10,
      }),
    ]);

    localAssets.clients = localAssets.clients.map((client) => {
      if (!client.express_configuration) return client;

      const userAttributeProfileName = client.express_configuration.user_attribute_profile_id;
      if (userAttributeProfileName) {
        const userAttributeProfile = userAttributeProfiles.find(
          (profile) => profile.name === userAttributeProfileName
        );
        if (userAttributeProfile?.id) {
          client.express_configuration.user_attribute_profile_id = userAttributeProfile.id;
        }
      }

      const connectionProfileName = client.express_configuration.connection_profile_id;
      if (connectionProfileName) {
        const connectionProfile = connectionProfiles.find(
          (profile) => profile.name === connectionProfileName
        );
        if (connectionProfile?.id) {
          client.express_configuration.connection_profile_id = connectionProfile.id;
        }
      }

      const oktaOinClientName = client.express_configuration.okta_oin_client_id;
      if (oktaOinClientName) {
        const oktaOinClient = clientsRemoteData.find(
          (remoteClient) => remoteClient.name === oktaOinClientName
        );
        if (oktaOinClient?.client_id) {
          client.express_configuration.okta_oin_client_id = oktaOinClient.client_id;
        }
      }

      return client;
    });
  }

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

  if (localAssets.connections) {
    const { connections } = localAssets;
    localAssets.connections = connections.map((connection) => {
      if (connection.strategy === 'samlp' && connection.options) {
        if ('cert' in connection.options) {
          connection.options.cert = decodeBase64ToCertString(connection.options.cert);
        }
      }
      if (connection.options?.idpinitiated?.client_id) {
        connection.options.idpinitiated.client_id = convertClientNameToId(
          connection.options.idpinitiated.client_id,
          clientsRemoteData
        );
      }
      if (connection.enabled_clients) {
        connection.enabled_clients = connection.enabled_clients.map((clientName) =>
          convertClientNameToId(clientName, clientsRemoteData)
        );
      }
      return connection;
    });
  }

  if (localAssets.organizations?.some((organization) => organization.connections?.length)) {
    const existingConnections = await paginate<Asset>(authAPIclient.connections.list, {
      checkpoint: true,
    });

    localAssets.organizations = localAssets.organizations.map((organization) => {
      if (!organization.connections?.length) {
        return organization;
      }

      organization.connections = organization.connections
        .map((connection) => {
          const formattedConnection = { ...connection };
          const connectionName = formattedConnection.name;

          if (connectionName) {
            formattedConnection.connection_id = existingConnections.find(
              (existingConnection) => existingConnection.name === connectionName
            )?.id;
            delete formattedConnection.name;
          }

          return formattedConnection;
        })
        .filter((connection) => !!connection.connection_id);

      return organization;
    });
  }

  if (localAssets.tenant) {
    localAssets.tenant = normalizeTenantForDryRun(localAssets.tenant);
  }

  if (localAssets.branding) {
    const { branding } = localAssets;
    // Empty templates array signals "no templates" — skip remote comparison to avoid false diffs
    if (branding.templates && branding.templates.length === 0) {
      delete branding.templates;
    }
    localAssets.branding = branding;
  }

  return localAssets;
}
