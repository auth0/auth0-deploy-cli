import ValidationError from '../../validationError';

import constants from '../../constants';
import DefaultHandler from './default';
import { calculateChanges } from '../../calculateChanges';
import log from '../../../logger';
import { detectInsufficientScopeError } from '../../utils';
import { Asset, Assets, CalculatedChanges } from '../../../types';

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
    },
    required: ['name', 'identifier'],
  },
};

export default class ResourceServersHandler extends DefaultHandler {
  existing: Asset[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'resourceServers',
      stripUpdateFields: ['identifier'], // Fields not allowed in updates
    });
  }

  objString(resourceServer): string {
    return super.objString({ name: resourceServer.name, identifier: resourceServer.identifier });
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) return this.existing;
    const resourceServers = await this.client.resourceServers.getAll({
      paginate: true,
      include_totals: true,
    });
    return resourceServers.filter(
      (rs) => rs.name !== constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME
    );
  }

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

    const {
      data,
      hadSufficientScopes,
      requiredScopes,
    } = await detectInsufficientScopeError<Asset[]>(() => this.getType());
    if (!hadSufficientScopes) {
      log.warn(`Cannot process ${this.type} due to missing scopes: ${requiredScopes}`);
      return {
        del: [],
        create: [],
        conflicts: [],
        update: [],
      };
    }

    // Filter excluded
    resourceServers = resourceServers.filter((r) => !excluded.includes(r.name));
    const existing = data.filter((r) => !excluded.includes(r.name));

    return calculateChanges({
      handler: this,
      assets: resourceServers,
      existing,
      identifiers: ['id', 'identifier'],
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });
  }

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
