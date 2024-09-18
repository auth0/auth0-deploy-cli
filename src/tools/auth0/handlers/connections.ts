import dotProp from 'dot-prop';
import _ from 'lodash';
import { Client, Connection } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import { filterExcluded, convertClientNameToId, getEnabledClients } from '../../utils';
import { CalculatedChanges, Asset, Assets } from '../../../types';
import { ConfigFunction } from '../../../configFactory';
import { paginate } from '../client';

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

export default class ConnectionsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'connections',
      stripUpdateFields: ['strategy', 'name'],
    });
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
      paginate: true,
      include_totals: true,
    });
    // Filter out database connections
    this.existing = connections.filter((c) => c.strategy !== 'auth0');
    if (this.existing === null) return [];
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
      paginate: true,
      include_totals: true,
    });
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
