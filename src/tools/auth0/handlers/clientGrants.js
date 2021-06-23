import DefaultHandler, { order } from './default';
import { convertClientNamesToIds } from '../../utils';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      client_id: { type: 'string' },
      audience: { type: 'string' },
      scope: {
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true
      }
    },
    required: [ 'client_id', 'scope', 'audience' ]
  }
};

export default class ClientHandler extends DefaultHandler {
  constructor(config) {
    super({
      ...config,
      type: 'clientGrants',
      id: 'id',
      identifiers: [ 'id', [ 'client_id', 'audience' ] ],
      stripUpdateFields: [ 'audience', 'client_id' ]
    });
  }

  objString(item) {
    return super.objString({ id: item.id, client_id: item.client_id, audience: item.audience });
  }

  async getType() {
    if (this.existing) {
      return this.existing;
    }
    this.existing = await this.client.clientGrants.getAll({ paginate: true, include_totals: true });

    // Always filter out the client we are using to access Auth0 Management API
    // As it could cause problems if the grants are deleted or updated etc
    const currentClient = this.config('AUTH0_CLIENT_ID');

    this.existing = this.existing.filter((grant) => grant.client_id !== currentClient);

    return this.existing;
  }

  // Run after clients are updated so we can convert client_id names to id's
  @order('60')
  async processChanges(assets) {
    const { clientGrants } = assets;

    // Do nothing if not set
    if (!clientGrants) return;

    const clients = await this.client.clients.getAll({ paginate: true, include_totals: true });
    const excludedClientsByNames = (assets.exclude && assets.exclude.clients) || [];
    const excludedClients = convertClientNamesToIds(excludedClientsByNames, clients);

    // Convert clients by name to the id
    const formatted = assets.clientGrants.map((clientGrant) => {
      const grant = { ...clientGrant };
      const found = clients.find((c) => c.name === grant.client_id);
      if (found) grant.client_id = found.client_id;
      return grant;
    });

    // Always filter out the client we are using to access Auth0 Management API
    const currentClient = this.config('AUTH0_CLIENT_ID');

    const {
      del, update, create, conflicts
    } = await this.calcChanges({ ...assets, clientGrants: formatted });

    const filterGrants = (list) => {
      if (excludedClients.length) {
        return list.filter((item) => item.client_id !== currentClient && ![ ...excludedClientsByNames, ...excludedClients ].includes(item.client_id));
      }

      return list.filter((item) => item.client_id !== currentClient);
    };

    const changes = {
      del: filterGrants(del),
      update: filterGrants(update),
      create: filterGrants(create),
      conflicts: filterGrants(conflicts)
    };

    await super.processChanges(assets, {
      ...changes
    });
  }
}
