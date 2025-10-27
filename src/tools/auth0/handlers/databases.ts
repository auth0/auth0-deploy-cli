import { Client, Connection, GetConnectionsStrategyEnum } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import constants from '../../constants';
import { filterExcluded, getEnabledClients } from '../../utils';
import { CalculatedChanges, Assets } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';
import { getConnectionEnabledClients, processConnectionEnabledClients } from './connections';

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
          attributes: {
            type: 'object',
            properties: {
              email: {
                type: 'object',
                properties: {
                  unique: { type: 'boolean', default: true },
                  identifier: {
                    type: 'object',
                    properties: {
                      active: { type: 'boolean' },
                    },
                  },
                  profile_required: { type: 'boolean' },
                  verification_method: { type: 'string', enum: ['otp', 'link'] },
                  signup: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['required', 'optional', 'inactive'] },
                      verification: {
                        type: 'object',
                        properties: {
                          active: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
              phone_number: {
                type: 'object',
                properties: {
                  identifier: {
                    type: 'object',
                    properties: {
                      active: { type: 'boolean' },
                    },
                  },
                  profile_required: { type: 'boolean' },
                  signup: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['required', 'optional', 'inactive'] },
                      verification: {
                        type: 'object',
                        properties: {
                          active: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
              username: {
                type: 'object',
                properties: {
                  identifier: {
                    type: 'object',
                    properties: {
                      active: { type: 'boolean' },
                    },
                  },
                  profile_required: { type: 'boolean' },
                  signup: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['required', 'optional', 'inactive'] },
                    },
                  },
                },
              },
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

    // Validation helper function for email.unique constraints
    const validateEmailUniqueConstraints = (payload, operation) => {
      const emailAttributes = payload?.options?.attributes?.email;
      const usernameAttributes = payload?.options?.attributes?.username;
      const phoneAttributes = payload?.options?.attributes?.phone_number;

      if (emailAttributes?.unique === false) {
        // For both create and update: When email.unique = false, email.identifier.active cannot be true
        if (emailAttributes?.identifier?.active === true) {
          throw new Error(
            `Database "${payload.name}": Cannot set email.identifier.active to true when email.unique is false. Non-unique emails cannot be used as active identifiers.`
          );
        }

        // For create operation: When email is non-unique, username or phone_number identifier must be active
        if (operation === 'create') {
          const hasActiveNonEmailIdentifier =
            usernameAttributes?.identifier?.active === true ||
            phoneAttributes?.identifier?.active === true;

          if (!hasActiveNonEmailIdentifier) {
            throw new Error(
              `Database "${payload.name}": When creating a database with email.unique set to false, either username.identifier.active or phone_number.identifier.active must be set to true. A non-email identifier is required when emails are not unique.`
            );
          }
        }
      }
    };

    if (fn === 'create') {
      return (payload) => {
        // Validate before creating
        validateEmailUniqueConstraints(payload, 'create');
        return this.client.connections.create(payload);
      };
    }

    // If we going to update database, we need to get current options first
    if (fn === 'update') {
      return (params, payload) =>
        this.client.connections.get(params).then((response) => {
          const connection = response.data;
          const attributes = payload?.options?.attributes;
          const requiresUsername = payload?.options?.requires_username;
          const validation = payload?.options?.validation;

          if (attributes && (requiresUsername || validation)) {
            log.warn(
              'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
            );
          } else if (attributes) {
            delete connection.options.validation;
            delete connection.options.requires_username;
          } else if (requiresUsername || validation) {
            delete connection.options.attributes;
          }

          // Validate email.unique constraints before making API call
          validateEmailUniqueConstraints(payload, 'update');

          payload.options = { ...connection.options, ...payload.options };

          if (payload.options && Object.keys(payload.options).length === 0) {
            delete payload.options;
          }
          return this.client.connections.update(params, payload);
        });
    }

    return this.client.connections[fn].bind(this.client.connections);
  }

  async getType() {
    if (this.existing) return this.existing;

    const connections = await paginate<Connection>(this.client.connections.getAll, {
      strategy: [GetConnectionsStrategyEnum.auth0],
      checkpoint: true,
      include_totals: true,
    });

    const dbConnectionsWithEnabledClients = await Promise.all(
      connections.map(async (con) => {
        const enabledClients = await getConnectionEnabledClients(this.client, con.id);
        if (enabledClients && enabledClients?.length) {
          return { ...con, enabled_clients: enabledClients };
        }
        return con;
      })
    );

    // If options option is empty for all connection, log the missing options scope.
    const isOptionExists = dbConnectionsWithEnabledClients.every(
      (c) => c.options && Object.keys(c.options).length > 0
    );
    if (!isOptionExists) {
      log.warn(
        `Insufficient scope the read:connections_options scope is required to get ${this.type} options.`
      );
    }

    this.existing = dbConnectionsWithEnabledClients;

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
        checkpoint: true,
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

    // If options option is empty for all connection, log the missing options scope.
    const isOptionExists = databases.every((c) => c.options && Object.keys(c.options).length > 0);
    if (!isOptionExists) {
      log.warn(
        `Insufficient scope the update:connections_options scope is required to update ${this.type} options.`
      );
    }

    const excludedConnections: string[] = (assets.exclude && assets.exclude.databases) || [];

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
