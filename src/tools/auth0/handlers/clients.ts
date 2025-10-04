import { Management } from 'auth0';
import { Assets } from '../../../types';
import { paginate } from '../client';
import DefaultAPIHandler from './default';

const multiResourceRefreshTokenPolicies = {
  type: ['array', 'null'],
  description:
    'A collection of policies governing multi-resource refresh token exchange (MRRT), defining how refresh tokens can be used across different resource servers',
  items: {
    type: 'object',
    properties: {
      audience: {
        type: 'string',
      },
      scope: {
        type: 'array',
        items: {
          type: 'string',
        },
        uniqueItems: true,
      },
    },
    required: ['audience', 'scope'],
  },
};

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, pattern: '[^<>]+' },
      mobile: {
        type: 'object',
        properties: {
          android: {
            type: 'object',
            properties: {
              app_package_name: { type: 'string' },
              sha256_cert_fingerprints: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          ios: {
            type: 'object',
            properties: {
              team_id: { type: 'string' },
              app_bundle_identifier: { type: 'string' },
            },
          },
        },
      },
      native_social_login: {
        type: 'object',
        properties: {
          apple: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
            },
          },
          facebook: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
            },
          },
          google: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
            },
          },
        },
      },
      refresh_token: {
        type: ['object', 'null'],
        description: 'Refresh token configuration',
        properties: {
          policies: multiResourceRefreshTokenPolicies,
        },
      },
      token_quota: {
        type: ['object', 'null'],
        properties: {
          client_credentials: {
            type: 'object',
            properties: {
              enforce: {
                type: 'boolean',
                default: true,
              },
              per_day: {
                type: 'integer',
                minimum: 1,
              },
              per_hour: {
                type: 'integer',
                minimum: 1,
              },
            },
            additionalProperties: false,
            minProperties: 1,
          },
        },
        required: ['client_credentials'],
      },
      session_transfer: {
        type: 'object',
        properties: {
          can_create_session_transfer_token: {
            type: 'boolean',
            default: false,
            description:
              'Specifies whether the application (Native app) can use the Token Exchange endpoint to create a session_transfer_token.',
          },
          allowed_authentication_methods: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['cookie', 'query'],
            },
            default: [],
            description:
              'Determines the methods allowed for a web application to create a session using a session_transfer_token.',
          },
          enforce_device_binding: {
            type: 'string',
            enum: ['none', 'ip', 'asn'],
            default: 'ip',
            description:
              'Configures the level of device binding enforced when a session_transfer_token is consumed.',
          },
        },
        additionalProperties: false,
      },
      app_type: {
        type: 'string',
        description: 'The type of application this client represents',
      },
      resource_server_identifier: {
        type: 'string',
        description:
          'The identifier of a resource server in your tenant. This property links a client to a resource server indicating that the client IS that resource server. Can only be set when app_type=resource_server.',
      },
    },
    required: ['name'],
  },
};

export type Client = Management.Client;

export default class ClientHandler extends DefaultAPIHandler {
  existing: Client[];

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'clients',
      id: 'client_id',
      identifiers: ['client_id', 'name'],
      objectFields: ['client_metadata'],
      stripUpdateFields: [
        // Fields not allowed during updates
        'callback_url_template',
        'signing_keys',
        'global',
        'tenant',
        'jwt_configuration.secret_encoded',
        'resource_server_identifier',
      ],
      functions: {
        update: async (
          // eslint-disable-next-line camelcase
          { client_id }: { client_id: string },
          bodyParams: Management.UpdateClientRequestContent
        ) => this.client.clients.update(client_id, bodyParams),
      },
    });
  }

  objString(item): string {
    return super.objString({ name: item.name, client_id: item.client_id });
  }

  async processChanges(assets: Assets): Promise<void> {
    const { clients } = assets;

    // Do nothing if not set
    if (!clients) return;

    const excludedClients = (assets.exclude && assets.exclude.clients) || [];

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    // Always filter out the client we are using to access Auth0 Management API
    // As it could cause problems if it gets deleted or updated etc
    const currentClient = this.config('AUTH0_CLIENT_ID') || '';

    const filterClients = (list) => {
      if (excludedClients.length) {
        return list.filter(
          (item) => item.client_id !== currentClient && !excludedClients.includes(item.name)
        );
      }

      return list.filter((item) => item.client_id !== currentClient);
    };

    // Sanitize client fields
    const sanitizeClientFields = (list) =>
      list.map((item) => {
        // For resourceServers app type `resource_server`, don't include `oidc_backchannel_logout`, `oidc_logout`, `refresh_token`
        if (item.app_type === 'resource_server') {
          if ('oidc_backchannel_logout' in item) {
            delete item.oidc_backchannel_logout;
          }
          if ('oidc_logout' in item) {
            delete item.oidc_logout;
          }
          if ('refresh_token' in item) {
            delete item.refresh_token;
          }
        }
        return item;
      });

    const changes = {
      del: sanitizeClientFields(filterClients(del)),
      update: sanitizeClientFields(filterClients(update)),
      create: sanitizeClientFields(filterClients(create)),
      conflicts: sanitizeClientFields(filterClients(conflicts)),
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }

  async getType() {
    if (this.existing) return this.existing;

    const clients = await paginate<Client>(this.client.clients.list, {
      paginate: true,
      is_global: false,
    });

    this.existing = clients;
    return this.existing;
  }
}
