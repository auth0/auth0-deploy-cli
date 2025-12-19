import dotProp from 'dot-prop';
import { chunk, keyBy } from 'lodash';
import { Management } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import { filterExcluded, convertClientNameToId, getEnabledClients, sleep } from '../../utils';
import { CalculatedChanges, Asset, Assets, Auth0APIClient } from '../../../types';
import { ConfigFunction } from '../../../configFactory';
import { paginate } from '../client';
import ScimHandler from './scimHandler';
import log from '../../../logger';
import { Client } from './clients';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      strategy: { type: 'string' },
      options: { type: 'object' },
      enabled_clients: { type: 'array', items: { type: 'string' } },
      realms: { type: 'array', items: { type: 'string' } },
      metadata: { type: 'object' },
      scim_configuration: {
        type: 'object',
        properties: {
          connection_name: { type: 'string' },
          mapping: {
            type: 'array',
            items: {
              type: 'object',
              properties: { scim: { type: 'string' }, auth0: { type: 'string' } },
            },
          },
          user_id_attribute: { type: 'string' },
        },
        required: ['mapping', 'user_id_attribute'],
      },
      authentication: {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
        },
        required: ['active'],
        additionalProperties: false,
      },
      connected_accounts: {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
        },
        required: ['active'],
        additionalProperties: false,
      },
    },
    required: ['name', 'strategy'],
  },
};

export type Connection = Management.ConnectionForList;

// addExcludedConnectionPropertiesToChanges superimposes excluded properties on the `options` object. The Auth0 API
// will overwrite the options property when updating connections, so it is necessary to add excluded properties back in to prevent those excluded properties from being deleted.
// This use case is common because organizations may not want to expose sensitive connection details, but want to preserve them in the tenant.
// exported only for unit testing purposes
export const addExcludedConnectionPropertiesToChanges = ({
  proposedChanges,
  existingConnections,
  config,
}: {
  proposedChanges: CalculatedChanges;
  existingConnections: Asset[];
  config: ConfigFunction;
}) => {
  if (proposedChanges.update.length === 0) return proposedChanges;

  // @ts-ignore because this expects a parameter to be passed
  const excludedFields = config()?.EXCLUDED_PROPS?.connections || [];
  if (excludedFields.length === 0) return proposedChanges;

  const existingConnectionsMap = keyBy(existingConnections, 'id');
  const excludedOptions = excludedFields.filter(
    // Only include fields that pertain to options
    (excludedField) => excludedField.startsWith('options')
  );

  const newProposedUpdates = proposedChanges.update.map((proposedConnection) => {
    const currConnection = existingConnectionsMap[proposedConnection.id];
    const currentExcludedPropertyValues = excludedOptions.reduce(
      (agg, excludedField) => {
        if (!dotProp.has(currConnection, excludedField)) return agg;

        const currentExcludedFieldValue = dotProp.get(currConnection, excludedField);

        dotProp.set(agg, excludedField, currentExcludedFieldValue);
        return agg;
      },
      {
        options: {},
      }
    );

    return {
      ...proposedConnection,
      options: {
        ...proposedConnection.options,
        ...currentExcludedPropertyValues.options,
      },
    };
  });

  return {
    ...proposedChanges,
    update: newProposedUpdates,
  };
};

/**
 * Retrieves all enabled client IDs for a specific Auth0 connection.
 * @param auth0Client - The Auth0 API client instance used to make requests
 * @param connectionId - The unique identifier of the connection to fetch enabled clients for
 * @returns A promise that resolves to an array of client IDs, or null if connectionId is empty or an error occurs
 */
export const getConnectionEnabledClients = async (
  auth0Client: Auth0APIClient,
  connectionId: string
): Promise<string[] | null> => {
  if (!connectionId) return null;

  try {
    const enabledClientsFormatted: string[] = [];

    let enabledClients = await auth0Client.connections.clients.get(connectionId);

    do {
      if (enabledClients && enabledClients.data?.length > 0) {
        enabledClients.data.forEach((client) => {
          if (client?.client_id) {
            enabledClientsFormatted.push(client.client_id);
          }
        });
      }

      enabledClients = await enabledClients.getNextPage();
    } while (enabledClients.hasNextPage());

    return enabledClientsFormatted;
  } catch (error) {
    return null;
  }
};

/**
 * Updates the enabled clients for a specific Auth0 connection.
 *
 * @param auth0Client - The Auth0 API client instance used to make the connection update request
 * @param typeName - The type name of the connection (used for error logging purposes)
 * @param connectionId - The unique identifier of the connection to update
 * @param enabledClientIds - Array of client IDs that should be enabled for this connection
 * @returns Promise that resolves to true if the update was successful, false otherwise
 *
 */
export const updateConnectionEnabledClients = async (
  auth0Client: Auth0APIClient,
  typeName: string,
  connectionId: string,
  enabledClientIds: string[]
): Promise<boolean> => {
  if (!connectionId || !Array.isArray(enabledClientIds) || !enabledClientIds.length) return false;

  const enabledClientUpdatePayloads: Management.UpdateEnabledClientConnectionsRequestContentItem[] =
    enabledClientIds.map((clientId) => ({
      client_id: clientId,
      status: true,
    }));

  const payloadChunks = chunk(enabledClientUpdatePayloads, 50);

  try {
    await Promise.all(
      payloadChunks.map((payload) => auth0Client.connections.clients.update(connectionId, payload))
    );
    log.debug(`Updated enabled clients for ${typeName}: ${connectionId}`);
    return true;
  } catch (error) {
    log.error(`Unable to update enabled clients for ${typeName}: ${connectionId}:`, error);
    return false;
  }
};

/**
 * This function processes enabled clients for create, update, and conflict operations.
 * Note: This function mutates the `create` array by adding IDs to the connection objects after creation.
 *
 * @param auth0Client - The Auth0 API client instance used to make API calls
 * @param typeName - The type of connection being processed (e.g., 'database', 'connection')
 * @param changes - Object containing arrays of connections to create, update, and resolve conflicts for
 * @param delayMs - Optional delay in milliseconds before fetching new connections (default: 2500ms)
 *
 * @returns A Promise that resolves when all enabled client updates are complete
 */
export const processConnectionEnabledClients = async (
  auth0Client: Auth0APIClient,
  typeName: string,
  changes: CalculatedChanges,
  delayMs: number = 2500 // Default delay is 2.5 seconds
) => {
  const { create, update, conflicts } = changes;

  let createWithId: Asset[] = [];
  if (create.length) {
    await sleep(delayMs); // Wait for the configured duration before fetching new connections

    createWithId = await Promise.all(
      create.map(async (conn) => {
        let newConnections;

        if (typeName === 'database') {
          const { data: connections } = await auth0Client.connections.list({
            name: conn.name,
            take: 1,
            strategy: [Management.ConnectionStrategyEnum.Auth0],
            include_fields: true,
          });
          newConnections = connections;
        } else {
          const { data: connections } = await auth0Client.connections.list({
            name: conn.name,
            take: 1,
            include_fields: true,
          });
          newConnections = connections;
        }

        if (newConnections && newConnections.length) {
          conn.id = newConnections[0]?.id;
        } else {
          log.warn(
            `Unable to find ID for newly created ${typeName} '${conn.name}' when updating enabled clients`
          );
        }
        return conn;
      })
    );
  }

  // Process enabled clients for each change type
  // Delete is handled by the `processChanges` method, removed connection completely
  await Promise.all([
    ...createWithId.map((conn) =>
      updateConnectionEnabledClients(auth0Client, typeName, conn.id, conn.enabled_clients)
    ),
    ...update.map((conn) =>
      updateConnectionEnabledClients(auth0Client, typeName, conn.id, conn.enabled_clients)
    ),
    ...conflicts.map((conn) =>
      updateConnectionEnabledClients(auth0Client, typeName, conn.id, conn.enabled_clients)
    ),
  ]);
};

export default class ConnectionsHandler extends DefaultAPIHandler {
  existing: Connection[] | null;

  scimHandler: ScimHandler;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'connections',
      stripUpdateFields: ['strategy', 'name'],
      functions: {
        // When `connections` is updated, it can result in `update`,`create` or `delete` action on SCIM.
        // Because, `scim_configuration` is inside `connections`.
        update: async (requestParams, bodyParams) =>
          this.scimHandler.updateOverride(requestParams, bodyParams),

        // When a new `connection` is created. We can perform only `create` option on SCIM.
        // When a connection is `deleted`. `scim_configuration` is also deleted along with it; no action on SCIM is required.
        create: async (bodyParams) => this.scimHandler.createOverride(bodyParams),
      },
    });

    // @ts-ignore
    this.scimHandler = new ScimHandler(this.config, this.client.connections, this.client.pool);
  }

  objString(connection): string {
    return super.objString({ name: connection.name, id: connection.id });
  }

  getFormattedOptions(connection, clients) {
    try {
      return {
        options: {
          ...connection.options,
          idpinitiated: {
            ...connection.options.idpinitiated,
            client_id: convertClientNameToId(connection.options.idpinitiated.client_id, clients),
          },
        },
      };
    } catch (e) {
      return {};
    }
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;

    const connections = await paginate<Connection>(this.client.connections.list, {
      checkpoint: true,
    });

    // Filter out database connections as we have separate handler for it
    const filteredConnections = connections.filter((c) => c.strategy !== 'auth0');

    // If options option is empty for all connection, log the missing options scope.
    const isOptionExists = filteredConnections.every(
      (c) => c.options && Object.keys(c.options).length > 0
    );
    if (!isOptionExists) {
      log.warn(
        `Insufficient scope the read:connections_options scope is required to get ${this.type} options.`
      );
    }

    this.existing = filteredConnections;
    if (this.existing === null) return [];

    const connectionsWithEnabledClients = await Promise.all(
      filteredConnections.map(async (con) => {
        if (!con?.id) return con;
        const enabledClients = await getConnectionEnabledClients(this.client, con.id);
        if (enabledClients && enabledClients?.length) {
          return { ...con, enabled_clients: enabledClients };
        }
        return con;
      })
    );

    this.existing = connectionsWithEnabledClients;

    // Apply `scim_configuration` to all the relevant `SCIM` connections. This method mutates `this.existing`.
    await this.scimHandler.applyScimConfiguration(this.existing);

    return this.existing;
  }

  async calcChanges(assets: Assets): Promise<CalculatedChanges> {
    const { connections } = assets;

    // Do nothing if not set
    if (!connections)
      return {
        del: [],
        create: [],
        update: [],
        conflicts: [],
      };

    const includedConnections = (assets.include && assets.include.connections) || [];
    const filteredConnections =
      includedConnections.length > 0
        ? connections.filter((conn) => includedConnections.includes(conn.name))
        : connections;

    // Convert enabled_clients by name to the id
    const clients = await paginate<Client>(this.client.clients.list, {
      paginate: true,
      include_totals: true,
    });

    const existingConnections = await paginate<Connection>(this.client.connections.list, {
      checkpoint: true,
      include_totals: true,
    });

    // Prepare an id map. We'll use this map later to get the `strategy` and SCIM enable status of the connections.
    await this.scimHandler.createIdMap(existingConnections);

    const formatted = filteredConnections.map((connection) => ({
      ...connection,
      ...this.getFormattedOptions(connection, clients),
      enabled_clients: getEnabledClients(assets, connection, existingConnections, clients),
    }));
    const proposedChanges = await super.calcChanges({ ...assets, connections: formatted });

    const proposedChangesWithExcludedProperties = addExcludedConnectionPropertiesToChanges({
      proposedChanges,
      existingConnections,
      config: this.config,
    });

    return proposedChangesWithExcludedProperties;
  }

  // Run after clients are updated so we can convert all the enabled_clients names to id's
  @order('60')
  async processChanges(assets: Assets): Promise<void> {
    const { connections } = assets;

    // Do nothing if not set
    if (!connections) return;

    // If options option is empty for all connection, log the missing options scope.
    const isOptionExists = connections.every((c) => c.options && Object.keys(c.options).length > 0);
    if (!isOptionExists) {
      log.warn(
        `Insufficient scope the update:connections_options scope is required to update ${this.type} options.`
      );
    }

    const excludedConnections = (assets.exclude && assets.exclude.connections) || [];

    const changes = await this.calcChanges(assets);

    await super.processChanges(assets, filterExcluded(changes, excludedConnections));

    // process enabled clients
    await processConnectionEnabledClients(
      this.client,
      this.type,
      filterExcluded(changes, excludedConnections)
    );
  }
}
