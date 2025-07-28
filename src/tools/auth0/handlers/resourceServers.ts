import { ResourceServer, ResourceServerProofOfPossessionMechanismEnum } from 'auth0';
import ValidationError from '../../validationError';

import constants from '../../constants';
import DefaultHandler from './default';
import { calculateChanges } from '../../calculateChanges';
import { Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';

export const excludeSchema = {
  type: 'array',
  items: { type: 'string' },
};

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      identifier: { type: 'string' },
      scopes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      enforce_policies: { type: 'boolean' },
      token_dialect: { type: 'string' },
      proof_of_possession: {
        type: 'object',
        properties: {
          mechanism: {
            type: 'string',
            enum: Object.values(ResourceServerProofOfPossessionMechanismEnum),
          },
          required: { type: 'boolean' },
        },
        required: ['mechanism', 'required'],
      },
    },
    required: ['name', 'identifier'],
  },
};

export default class ResourceServersHandler extends DefaultHandler {
  existing: ResourceServer[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'resourceServers',
      identifiers: ['id', 'identifier'],
      stripUpdateFields: ['identifier'], // Fields not allowed in updates
    });
  }

  objString(resourceServer): string {
    return super.objString({ name: resourceServer.name, identifier: resourceServer.identifier });
  }

  async getType(): Promise<ResourceServer[]> {
    if (this.existing) return this.existing;

    const resourceServers = await paginate<ResourceServer>(this.client.resourceServers.getAll, {
      paginate: true,
      include_totals: true,
    });
    return resourceServers.filter(
      (rs) => rs.name !== constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME
    );
  }

  async processChanges(assets: Assets): Promise<void> {
    const { resourceServers } = assets;

    // Do nothing if not set
    if (!resourceServers) return;

    const excluded = (assets.exclude && assets.exclude.resourceServers) || [];

    const filterResourceServer = (items) => items.filter((r) => !excluded.includes(r.name));

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    const changes = {
      del: filterResourceServer(del),
      update: filterResourceServer(update),
      create: filterResourceServer(create),
      conflicts: filterResourceServer(conflicts),
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }

  /*
  async calcChanges(assets: Assets): Promise<CalculatedChanges> {
    let { resourceServers } = assets;

    // Do nothing if not set
    if (!resourceServers)
      return {
        del: [],
        create: [],
        conflicts: [],
        update: [],
      };

    const excluded = (assets.exclude && assets.exclude.resourceServers) || [];

    let existing = await this.getType();

    // Filter excluded
    resourceServers = resourceServers.filter((r) => !excluded.includes(r.name));
    existing = existing.filter((r) => !excluded.includes(r.name));

    return calculateChanges({
      handler: this,
      assets: resourceServers,
      existing,
      identifiers: this.identifiers,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });
  }
  */

  async validate(assets: Assets): Promise<void> {
    const { resourceServers } = assets;

    // Do nothing if not set
    if (!resourceServers) return;

    const mgmtAPIResource = resourceServers.find(
      (r) => r.name === constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME
    );
    if (mgmtAPIResource) {
      throw new ValidationError(
        `You can not configure the '${constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME}'.`
      );
    }

    await super.validate(assets);
  }
}
