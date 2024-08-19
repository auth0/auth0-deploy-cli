import { Client, Connection, GetConnectionsStrategyEnum } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import constants from '../../constants';
import { filterExcluded, getEnabledClients } from '../../utils';
import { CalculatedChanges, Assets } from '../../../types';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      strategy: { type: 'string', enum: ['auth0'], default: 'auth0' },
      name: { type: 'string' },
      options: {
        type: 'object',
        properties: {
          customScripts: {
            type: 'object',
            properties: {
              ...constants.DATABASE_SCRIPTS.reduce(
                (o, script) => ({ ...o, [script]: { type: 'string' } }),
                {}
              ),
            },
          },
        },
      },
    },
    required: ['name'],
  },
};

export default class DatabaseHandler extends DefaultAPIHandler {
  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'databases',
      stripUpdateFields: ['strategy', 'name'],
    });
  }

  objString(db) {
    return super.objString({ name: db.name, id: db.id });
  }

  getClientFN(fn: 'create' | 'delete' | 'getAll' | 'update'): Function {
    // Override this as a database is actually a connection but we are treating them as a different object
    // If we going to update database, we need to get current options first
    if (fn === 'update') {
      return (params, payload) =>
        this.client.connections.get(params).then(({ data: connection }) => {
          payload.options = { ...connection.options, ...payload.options };
          return this.client.connections.update(params, payload);
        });
    }

    return this.client.connections[fn].bind(this.client.connections);
  }

  async getType() {
    if (this.existing) return this.existing;

    const allConnections: Connection[] = [];
    let page: number = 0;

    // paginate through all connections
    while (true) {
      const {
        data: { connections, total },
      } = await this.client.connections.getAll({
        strategy: [GetConnectionsStrategyEnum.auth0],
        include_totals: true,
        page: page,
      });
      allConnections.push(...connections);
      page += 1;
      if (allConnections.length === total) {
        break;
      }
    }

    this.existing = allConnections;

    return this.existing;
  }

  async calcChanges(assets: Assets): Promise<CalculatedChanges> {
    const { databases } = assets;

    // Do nothing if not set
    if (!databases)
      return {
        del: [],
        create: [],
        update: [],
        conflicts: [],
      };

    // Convert enabled_clients by name to the id

    const allClients: Client[] = [];
    let page: number = 0;
    // paginate through all clients
    while (true) {
      const {
        data: { clients, total },
      } = await this.client.clients.getAll({ include_totals: true, page: page });
      allClients.push(...clients);
      page += 1;
      if (allClients.length === total) {
        break;
      }
    }

    const allExistingDatabasesConnections: Connection[] = [];
    page = 0;

    // paginate through all connections
    while (true) {
      const {
        data: { connections, total },
      } = await this.client.connections.getAll({
        strategy: [GetConnectionsStrategyEnum.auth0],
        include_totals: true,
        page: page,
      });
      allExistingDatabasesConnections.push(...connections);
      page += 1;
      if (allExistingDatabasesConnections.length === total) {
        break;
      }
    }

    const formatted = databases.map((db) => {
      if (db.enabled_clients) {
        return {
          ...db,
          enabled_clients: getEnabledClients(
            assets,
            db,
            allExistingDatabasesConnections,
            allClients
          ),
        };
      }

      return db;
    });

    return super.calcChanges({ ...assets, databases: formatted });
  }

  // Run after clients are updated so we can convert all the enabled_clients names to id's
  @order('60')
  async processChanges(assets: Assets) {
    const { databases } = assets;

    // Do nothing if not set
    if (!databases) return;

    const excludedConnections: string[] = (assets.exclude && assets.exclude.databases) || [];

    const changes = await this.calcChanges(assets);

    await super.processChanges(assets, filterExcluded(changes, excludedConnections));
  }
}
