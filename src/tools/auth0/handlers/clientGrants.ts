import { Client } from 'auth0';
import DefaultHandler, { order } from './default';
import { convertClientNamesToIds } from '../../utils';
import { Assets, CalculatedChanges } from '../../../types';
import DefaultAPIHandler from './default';

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
        uniqueItems: true,
      },
    },
    required: ['client_id', 'scope', 'audience'],
  },
};

export type ClientGrant = {
  client_id: string;
  audience: string;
  scope: string[];
};

export default class ClientGrantsHandler extends DefaultHandler {
  existing: ClientGrant[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'clientGrants',
      id: 'id',
      //@ts-ignore because not sure why two-dimensional array passed in
      identifiers: ['id', ['client_id', 'audience']],
      stripUpdateFields: ['audience', 'client_id'],
    });
  }

  objString(item): string {
    return super.objString({ id: item.id, client_id: item.client_id, audience: item.audience });
  }

  async getType(): Promise<ClientGrant[]> {
    if (this.existing) {
      return this.existing;
    }

    const allClientGrants: ClientGrant[] = [];
    let page: number = 0;
    // paginate through all client grants
    while (true) {
      const {
        data: { client_grants: clientGrants, total },
      } = await this.client.clientGrants.getAll({ include_totals: true, page: page });
      allClientGrants.push(...clientGrants);
      page += 1;
      if (allClientGrants.length === total) {
        break;
      }
    }
    this.existing = allClientGrants;

    // Always filter out the client we are using to access Auth0 Management API
    // As it could cause problems if the grants are deleted or updated etc
    const currentClient = this.config('AUTH0_CLIENT_ID');

    this.existing = this.existing.filter((grant) => grant.client_id !== currentClient);

    return this.existing;
  }

  // Run after clients are updated so we can convert client_id names to id's
  @order('60')
  async processChanges(assets: Assets): Promise<void> {
    const { clientGrants } = assets;

    // Do nothing if not set
    if (!clientGrants) return;

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

    const excludedClientsByNames = (assets.exclude && assets.exclude.clients) || [];
    const excludedClients = convertClientNamesToIds(excludedClientsByNames, allClients);

    // Convert clients by name to the id
    const formatted = clientGrants.map((clientGrant) => {
      const grant = { ...clientGrant };
      const found = allClients.find((c) => c.name === grant.client_id);
      if (found) grant.client_id = found.client_id;
      return grant;
    });

    // Always filter out the client we are using to access Auth0 Management API
    const currentClient = this.config('AUTH0_CLIENT_ID');

    const { del, update, create, conflicts } = await this.calcChanges({
      ...assets,
      clientGrants: formatted,
    });

    // eslint-disable-next-line camelcase
    const filterGrants = (list: { client_id: string }[]) => {
      if (excludedClients.length) {
        return list.filter(
          (item) =>
            item.client_id !== currentClient &&
            ![...excludedClientsByNames, ...excludedClients].includes(item.client_id)
        );
      }

      return list.filter((item) => item.client_id !== currentClient);
    };

    const changes: CalculatedChanges = {
      //@ts-ignore because this expects `client_id` and that's not yet typed on Asset
      del: filterGrants(del),
      //@ts-ignore because this expects `client_id` and that's not yet typed on Asset
      update: filterGrants(update),
      //@ts-ignore because this expects `client_id` and that's not yet typed on Asset
      create: filterGrants(create),
      //@ts-ignore because this expects `client_id` and that's not yet typed on Asset
      conflicts: filterGrants(conflicts),
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }
}
