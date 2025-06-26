import dotProp from 'dot-prop';
import _ from 'lodash';
import { Client, Connection } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import { filterExcluded, convertClientNameToId, getEnabledClients } from '../../utils';
import { CalculatedChanges, Asset, Assets, Auth0APIClient } from '../../../types';
import { ConfigFunction } from '../../../configFactory';
import { paginate } from '../client';
import ScimHandler from './scimHandler';
import log from '../../../logger';

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
    },
    required: ['name', 'strategy'],
  },
};

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

  //@ts-ignore because this expects a parameter to be passed
  const excludedFields = config()?.EXCLUDED_PROPS?.connections || [];
  if (excludedFields.length === 0) return proposedChanges;

  const existingConnectionsMap = _.keyBy(existingConnections, 'id');
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
export const getConnectionEnableClients = async (
  auth0Client: Auth0APIClient,
  connectionId: string
): Promise<string[] | null> => {
  if (!connectionId) return null;

  try {
    const enableClientsFormated: string[] = [];
    let from: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await auth0Client.connections.getEnabledClients({
        id: connectionId,
        take: 50,
        ...(from && { from }),
      });

      const { clients: enableClients, next } = response?.data || {};

      if (enableClients?.length) {
        enableClients.forEach((client) => {
          if (client?.client_id) {
            enableClientsFormated.push(client.client_id);
          }
        });
      }

      hasMore = !!next;
      from = next;
    }

    return enableClientsFormated;
  } catch (error) {
    log.error(`Error fetching enabled clients for connection ${connectionId}:`, error);
    return null;
  }
};

export default class ConnectionsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;
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
          await this.scimHandler.updateOverride(requestParams, bodyParams),

        // When a new `connection` is created. We can perform only `create` option on SCIM.
        // When a connection is `deleted`. `scim_configuration` is also deleted along with it; no action on SCIM is required.
        create: async (bodyParams) => await this.scimHandler.createOverride(bodyParams),
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

    const connections = await paginate<Connection>(this.client.connections.getAll, {
      checkpoint: true,
      include_totals: true,
    });

    // Filter out database connections as we have separate handler for it
    const filteredConnections = connections.filter((c) => c.strategy !== 'auth0');
    this.existing = filteredConnections;
    if (this.existing === null) return [];

    const updatedConnections = await Promise.all(
      filteredConnections.map(async (con) => {
        const enabledClients = await getConnectionEnableClients(this.client, con.id);
        if (enabledClients && enabledClients?.length) {
          // Return a new object with enabled_clients updated
          return { ...con, enabled_clients: enabledClients };
        }
        return con;
      })
    );

    this.existing = updatedConnections;

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

    // Convert enabled_clients by name to the id
    const clients = await paginate<Client>(this.client.clients.getAll, {
      paginate: true,
      include_totals: true,
    });

    const existingConnections = await paginate<Connection>(this.client.connections.getAll, {
      checkpoint: true,
      include_totals: true,
    });

    // Prepare an id map. We'll use this map later to get the `strategy` and SCIM enable status of the connections.
    await this.scimHandler.createIdMap(existingConnections);

    const formatted = connections.map((connection) => ({
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

    const excludedConnections = (assets.exclude && assets.exclude.connections) || [];

    const changes = await this.calcChanges(assets);

    await super.processChanges(assets, filterExcluded(changes, excludedConnections));
  }
}
