import { ConnectionProfile } from 'auth0';
import { Assets } from '../../../types';
import DefaultAPIHandler from './default';
import { paginate } from '../client';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
      },
      organization: {
        type: 'object',
        properties: {
          show_as_button: {
            type: 'string',
            enum: ['none', 'optional', 'required'],
          },
          assign_membership_on_login: {
            type: 'string',
            enum: ['none', 'optional', 'required'],
          },
        },
      },
      connection_name_prefix_template: {
        type: 'string',
      },
      enabled_features: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['scim', 'universal_logout'],
        },
        uniqueItems: true,
      },
      connection_config: {
        type: 'object',
      },
      strategy_overrides: {
        type: 'object',
        properties: {
          pingfederate: {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
          ad: {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
          adfs: {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
          waad: {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
          'google-apps': {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
          okta: {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
          oidc: {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
          samlp: {
            type: 'object',
            properties: {
              enabled_features: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['scim', 'universal_logout'],
                },
                uniqueItems: true,
              },
              connection_config: {
                type: 'object',
              },
            },
          },
        },
      },
    },
    required: ['name'],
  },
};

export default class ConnectionProfilesHandler extends DefaultAPIHandler {
  existing: ConnectionProfile[];

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'connectionProfiles',
      id: 'id',
      identifiers: ['id', 'name'],
      stripUpdateFields: ['id'],
    });
  }

  async getType(): Promise<ConnectionProfile[]> {
    if (this.existing) return this.existing;

    const connectionProfiles = await paginate<ConnectionProfile>(
      this.client.connectionProfiles?.getAll,
      {
        checkpoint: true,
      }
    );

    this.existing = connectionProfiles;
    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { connectionProfiles } = assets;

    // Do nothing if not set
    if (!connectionProfiles) return;

    // Process using the default implementation
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
