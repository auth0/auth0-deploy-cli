import DefaultHandler, { order } from './default';
import constants from '../../constants';
import { filterExcluded, getEnabledClients } from '../../utils';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      strategy: { type: 'string', enum: [ 'auth0' ], default: 'auth0' },
      name: { type: 'string' },
      options: {
        type: 'object',
        properties: {
          customScripts: {
            type: 'object',
            properties: {
              ...constants.DATABASE_SCRIPTS.reduce((o, script) => ({ ...o, [script]: { type: 'string' } }), {})
            }
          }
        }
      }
    },
    required: [ 'name' ]
  }
};

export default class DatabaseHandler extends DefaultHandler {
  constructor(config) {
    super({
      ...config,
      type: 'databases',
      stripUpdateFields: [ 'strategy', 'name' ]
    });
  }

  objString(db) {
    return super.objString({ name: db.name, id: db.id });
  }

  getClientFN(fn) {
    // Override this as a database is actually a connection but we are treating them as a different object
    // If we going to update database, we need to get current options first
    if (fn === this.functions.update) {
      return (params, payload) => this.client.connections.get(params)
        .then((connection) => {
          payload.options = { ...connection.options, ...payload.options };
          return this.client.connections.update(params, payload);
        });
    }

    return Reflect.get(this.client.connections, fn, this.client.connections);
  }

  async getType() {
    if (this.existing) return this.existing;
    this.existing = this.client.connections.getAll({ strategy: 'auth0', paginate: true, include_totals: true });

    return this.existing;
  }

  async calcChanges(assets) {
    const { databases } = assets;

    // Do nothing if not set
    if (!databases) return {};

    // Convert enabled_clients by name to the id
    const clients = await this.client.clients.getAll({ paginate: true, include_totals: true });
    const existingDatabasesConecctions = await this.client.connections.getAll({ strategy: 'auth0', paginate: true, include_totals: true });
    const formatted = databases.map((db) => {
      if (db.enabled_clients) {
        return {
          ...db,
          enabled_clients: getEnabledClients(assets, db, existingDatabasesConecctions, clients)
        };
      }

      return db;
    });

    return super.calcChanges({ ...assets, databases: formatted });
  }

  // Run after clients are updated so we can convert all the enabled_clients names to id's
  @order('60')
  async processChanges(assets) {
    const { databases } = assets;

    // Do nothing if not set
    if (!databases) return;

    const excludedConnections = (assets.exclude && assets.exclude.databases) || [];

    const changes = await this.calcChanges(assets);

    await super.processChanges(assets, filterExcluded(changes, excludedConnections));
  }
}
