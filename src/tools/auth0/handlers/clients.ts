import { ApiResponse, Assets, PagePaginationParams } from '../../../types';
import { paginate } from '../client';
import DefaultAPIHandler from './default';

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
    },
    required: ['name'],
  },
};

export type Client = {
  client_id: string;
  name: string;
  custom_login_page?: string;
  custom_login_page_on?: boolean;
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

    const changes = {
      del: filterClients(del),
      update: filterClients(update),
      create: filterClients(create),
      conflicts: filterClients(conflicts),
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
}
