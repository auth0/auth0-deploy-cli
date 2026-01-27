import { Management } from 'auth0';
import DefaultHandler, { order } from './default';
import { convertClientNamesToIds } from '../../utils';
import { Assets, CalculatedChanges } from '../../../types';
import DefaultAPIHandler from './default';
import { paginate } from '../client';
import { Client } from './clients';

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
      subject_type: {
        type: 'string',
        enum: Object.values(Management.ClientGrantSubjectTypeEnum),
        description: 'The subject type for this grant.',
      },
      authorization_details_types: {
        type: 'array',
        description: 'Types of authorization_details allowed for this client grant.',
        items: {
          type: 'string',
        },
        uniqueItems: true,
      },
      allow_all_scopes: {
        type: 'boolean',
        description: 'When enabled, all scopes configured on the resource server are allowed for by this client grant.',
      },
    },
    required: ['client_id', 'audience'],
  },
};

export type ClientGrant = Management.ClientGrantResponseContent;

export default class ClientGrantsHandler extends DefaultHandler {
  existing: ClientGrant[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'clientGrants',
      id: 'id',
      // @ts-ignore because not sure why two-dimensional array passed in
      identifiers: ['id', ['client_id', 'audience']],
      stripUpdateFields: ['audience', 'client_id', 'subject_type', 'is_system'],
    });
  }

  objString(item): string {
    return super.objString({ id: item.id, client_id: item.client_id, audience: item.audience });
  }

  async validate(assets: Assets): Promise<void> {
    const { clientGrants } = assets;

    // Do nothing if not set
    if (!clientGrants) return;

    // Validate each client grant
    clientGrants.forEach((grant) => {
      // When allow_all_scopes is true, scope should not be present
      if (grant.allow_all_scopes === true && grant.scope && grant.scope.length > 0) {
        throw new Error(
          `Client grant for client_id "${grant.client_id}" and audience "${grant.audience}": Cannot specify "scope" when "allow_all_scopes" is set to true. Remove the "scope" property or set "allow_all_scopes" to false.`
        );
      }
    });

    await super.validate(assets);
  }

  async getType(): Promise<ClientGrant[]> {
    if (this.existing) {
      return this.existing;
    }

    const clientGrants = await paginate<ClientGrant>(this.client.clientGrants.list, {
      checkpoint: true,
    });

    this.existing = clientGrants;

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

    const clients = await paginate<Client>(this.client.clients.list, {
      paginate: true,
    });
    const excludedClientsByNames = (assets.exclude && assets.exclude.clients) || [];
    const excludedClients = convertClientNamesToIds(excludedClientsByNames, clients);

    // Convert clients by name to the id
    const formatted = clientGrants.map((clientGrant) => {
      const grant = { ...clientGrant };
      const found = clients.find((c) => c.name === grant.client_id);
      if (found) grant.client_id = found.client_id;
      return grant;
    });

    // Always filter out the client we are using to access Auth0 Management API
    const currentClient = this.config('AUTH0_CLIENT_ID');

    const { del, update, create, conflicts } = await this.calcChanges({
      ...assets,
      clientGrants: formatted,
    });

    const filterGrants = (list: ClientGrant[]) => {
      if (excludedClients.length) {
        return list.filter(
          (item) =>
            item.client_id !== currentClient &&
            item.client_id &&
            ![...excludedClientsByNames, ...excludedClients].includes(item.client_id)
        );
      }

      return list
        .filter((item) => item.client_id !== currentClient)
        .filter((item) => item.is_system !== true);
    };

    const changes: CalculatedChanges = {
      // @ts-ignore because this expects `client_id` and that's not yet typed on Asset
      del: filterGrants(del),
      // @ts-ignore because this expects `client_id` and that's not yet typed on Asset
      update: filterGrants(update),
      // @ts-ignore because this expects `client_id` and that's not yet typed on Asset
      create: filterGrants(create),
      // @ts-ignore because this expects `client_id` and that's not yet typed on Asset
      conflicts: filterGrants(conflicts),
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }
}
