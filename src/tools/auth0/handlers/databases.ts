import { Client, Connection, GetConnectionsStrategyEnum } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import constants from '../../constants';
import { filterExcluded, getEnabledClients } from '../../utils';
import { CalculatedChanges, Assets } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';

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
        this.client.connections.get(params).then((connection) => {
          const attributes = payload?.options?.attributes;
          const requiresUsername = payload?.options?.requires_username;
          const validation = payload?.options?.validation;

          if (attributes && (requiresUsername || validation)) {
            log.warn('Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.');
          }

          else if (attributes) {
            delete connection.options.validation;
            delete connection.options.requires_username;
          }

          else if (requiresUsername || validation) {
            delete connection.options.attributes;
          }

          payload.options = { ...connection.options, ...payload.options };
          return this.client.connections.update(params, payload);
        });
    }

    return this.client.connections[fn].bind(this.client.connections);
  }

  async getType() {
    if (this.existing) return this.existing;

    const connections = await paginate<Connection>(this.client.connections.getAll, {
      strategy: [GetConnectionsStrategyEnum.auth0],
      paginate: true,
      include_totals: true,
    });
    this.existing = connections;

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

    const clients = await paginate<Client>(this.client.clients.getAll, {
      paginate: true,
      include_totals: true,
    });

    const existingDatabasesConnections = await paginate<Connection>(
      this.client.connections.getAll,
      {
        strategy: [GetConnectionsStrategyEnum.auth0],
        paginate: true,
        include_totals: true,
      }
    );
    const formatted = databases.map((db) => {
      if (db.enabled_clients) {
        return {
          ...db,
          enabled_clients: getEnabledClients(assets, db, existingDatabasesConnections, clients),
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
