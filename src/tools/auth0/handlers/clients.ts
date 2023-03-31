import { Asset, Assets } from '../../../types';
import DefaultAPIHandler from './default';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, pattern: '[^<>]+' },
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
  existing: Asset[] | null;

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
    this.existing = await this.client.clients.getAll({
      paginate: true,
      include_totals: true,
      is_global: false,
    });
    return this.existing;
  }
}
