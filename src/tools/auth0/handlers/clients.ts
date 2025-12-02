import {
  ClientClientAuthenticationMethods,
  ClientExpressConfiguration,
  ClientOrganizationRequireBehaviorEnum,
} from 'auth0';
import { has, omit } from 'lodash';
import { Assets, Auth0APIClient } from '../../../types';
import { paginate } from '../client';
import DefaultAPIHandler from './default';
import { getConnectionProfile } from './connectionProfiles';
import { getUserAttributeProfiles } from './userAttributeProfiles';
import log from '../../../logger';

const multiResourceRefreshTokenPoliciesSchema = {
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
          policies: multiResourceRefreshTokenPoliciesSchema,
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
            description:
              "Indicates whether an app can issue a Session Transfer Token through Token Exchange. If set to 'false', the app will not be able to issue a Session Transfer Token. Usually configured in the native application.",
            default: false,
          },
          enforce_cascade_revocation: {
            type: 'boolean',
            description:
              'Indicates whether revoking the parent Refresh Token that initiated a Native to Web flow and was used to issue a Session Transfer Token should trigger a cascade revocation affecting its dependent child entities. Usually configured in the native application.',
            default: true,
          },
          allowed_authentication_methods: {
            type: ['array', 'null'],
            description:
              'Indicates whether an app can create a session from a Session Transfer Token received via indicated methods. Can include `cookie` and/or `query`. Usually configured in the web application.',
            items: {
              type: 'string',
              enum: ['cookie', 'query'],
            },
          },
          enforce_device_binding: {
            type: 'string',
            description:
              "Indicates whether device binding security should be enforced for the app. If set to 'ip', the app will enforce device binding by IP, meaning that consumption of Session Transfer Token must be done from the same IP of the issuer. Likewise, if set to 'asn', device binding is enforced by ASN, meaning consumption of Session Transfer Token must be done from the same ASN as the issuer. If set to 'null', device binding is not enforced. Usually configured in the web application.",
            enum: ['ip', 'asn', 'none'],
            default: 'ip',
          },
          allow_refresh_token: {
            type: 'boolean',
            description:
              'Indicates whether Refresh Tokens are allowed to be issued when authenticating with a Session Transfer Token. Usually configured in the web application.',
            default: false,
          },
          enforce_online_refresh_tokens: {
            type: 'boolean',
            description:
              "Indicates whether Refresh Tokens created during a native-to-web session are tied to that session's lifetime. This determines if such refresh tokens should be automatically revoked when their corresponding sessions are. Usually configured in the web application.",
            default: true,
          },
        },
        additionalProperties: true,
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
      organization_usage: {
        type: 'string',
        enum: ['deny', 'allow', 'require'],
      },
      organization_require_behavior: {
        type: 'string',
        enum: ['no_prompt', 'pre_login_prompt', 'post_login_prompt'],
      },
      organization_discovery_methods: {
        type: ['array', 'null'],
        items: {
          type: 'string',
          enum: ['email', 'organization_name'],
        },
      },
      async_approval_notification_channels: {
        type: ['array', 'null'],
        description:
          'An ordered array of notification channels enabled for CIBA (Client-Initiated Backchannel Authentication) requests. Channels are evaluated in the order specified.',
        items: {
          type: 'string',
          enum: ['guardian-push', 'email'],
        },
      },
      skip_non_verifiable_callback_uri_confirmation_prompt: {
        type: ['boolean', 'null'],
        description: 'Whether to skip the confirmation prompt for non-verifiable callback URIs',
      },
      express_configuration: {
        type: ['object', 'null'],
        description:
          'Application specific configuration for use with the OIN Express Configuration feature',
        properties: {
          initiate_login_uri_template: {
            type: 'string',
            description:
              'The URI users should bookmark to log in to this application. Variable substitution is permitted for the following properties: organization_name, organization_id, and connection_name.',
          },
          user_attribute_profile_id: {
            type: 'string',
            description: 'The ID of the user attribute profile to use for this application',
          },
          connection_profile_id: {
            type: 'string',
            description: 'The ID of the connection profile to use for this application',
          },
          enable_client: {
            type: 'boolean',
            description:
              'When true, all connections made via express configuration will be enabled for this application',
          },
          enable_organization: {
            type: 'boolean',
            description:
              'When true, all connections made via express configuration will have the associated organization enabled',
          },
          linked_clients: {
            type: 'array',
            description:
              'List of client IDs that are linked to this express configuration (e.g. web or mobile clients)',
            items: {
              type: 'object',
              properties: {
                client_id: {
                  type: 'string',
                  description: 'The ID of the linked client',
                },
              },
              required: ['client_id'],
            },
          },
          okta_oin_client_id: {
            type: 'string',
            description:
              'This is the unique identifier for the Okta OIN Express Configuration Client, which Okta will use for this application',
          },
          admin_login_domain: {
            type: 'string',
            description:
              'This is the domain that admins are expected to log in via for authenticating for express configuration. It can be either the canonical domain or a registered custom domain',
          },
          oin_submission_id: {
            type: 'string',
            description: 'The identifier of the published application in the OKTA OIN',
          },
        },
        required: [
          'initiate_login_uri_template',
          'user_attribute_profile_id',
          'connection_profile_id',
          'enable_client',
          'enable_organization',
          'okta_oin_client_id',
          'admin_login_domain',
        ],
      },
    },
    required: ['name'],
  },
};

export type Client = {
  client_id: string;
  name: string;
  app_type?: string;
  resource_server_identifier?: string;
  cross_origin_authentication?: boolean;
  cross_origin_auth?: boolean;
  custom_login_page?: string;
  custom_login_page_on?: boolean;
  express_configuration?: ClientExpressConfiguration;
  client_authentication_methods?: ClientClientAuthenticationMethods | null;
  organization_require_behavior?: ClientOrganizationRequireBehaviorEnum;
};

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
    });
  }

  objString(item): string {
    return super.objString({ name: item.name, client_id: item.client_id });
  }

  async processChanges(assets: Assets): Promise<void> {
    const { clients } = assets;

    // Do nothing if not set
    if (!clients) return;

    assets.clients = await this.sanitizeMapExpressConfiguration(this.client, clients);

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
    const sanitizeClientFields = (list: Client[]): Client[] =>
      list.map((item: Client) => {
        let fields = { ...item };

        // Sanitize the deprecated field `cross_origin_auth` to `cross_origin_authentication`
        if (has(fields, 'cross_origin_auth')) {
          log.warn(
            `Client '${item.name}': 'cross_origin_auth' is deprecated and may not be available in the future versions.`
          );

          if (!has(fields, 'cross_origin_authentication')) {
            fields.cross_origin_authentication = fields.cross_origin_auth;
          }
          fields = omit(fields, 'cross_origin_auth');
        }

        if (fields.app_type === 'resource_server') {
          if ('oidc_backchannel_logout' in fields) {
            delete fields.oidc_backchannel_logout;
          }
          if ('oidc_logout' in fields) {
            delete fields.oidc_logout;
          }
          if ('refresh_token' in fields) {
            delete fields.refresh_token;
          }
        }
        return fields;
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

    const clients = await paginate<Client>(this.client.clients.getAll, {
      paginate: true,
      include_totals: true,
      is_global: false,
    });

    this.existing = clients;
    return this.existing;
  }

  // convert names back to IDs for express configuration
  async sanitizeMapExpressConfiguration(
    auth0Client: Auth0APIClient,
    clientList: Client[]
  ): Promise<Client[]> {
    // if no clients have express configuration, return early
    if (!clientList.some((p) => p.express_configuration)) {
      return clientList;
    }

    const clientData = await this.getType();
    const connectionProfiles = await getConnectionProfile(auth0Client);
    const userAttributeProfiles = await getUserAttributeProfiles(auth0Client);

    return clientList.map((client) => {
      if (!client.express_configuration) return client;

      const userAttributeProfileName = client.express_configuration?.user_attribute_profile_id;
      if (userAttributeProfileName) {
        const userAttributeProfile = userAttributeProfiles?.find(
          (uap) => uap.name === userAttributeProfileName
        );
        if (userAttributeProfile?.id) {
          client.express_configuration.user_attribute_profile_id = userAttributeProfile.id;
        }
      }

      const connectionProfileName = client.express_configuration.connection_profile_id;
      if (connectionProfileName) {
        const connectionProfile = connectionProfiles?.find(
          (cp) => cp.name === connectionProfileName
        );
        if (connectionProfile?.id) {
          client.express_configuration.connection_profile_id = connectionProfile.id;
        }
      }

      const oktaOinClientName = client.express_configuration.okta_oin_client_id;
      if (oktaOinClientName) {
        const oktaOinClient = clientData?.find((c) => c.name === oktaOinClientName);
        if (oktaOinClient) {
          client.express_configuration.okta_oin_client_id = oktaOinClient.client_id;
        }
      }

      return client;
    });
  }
}
