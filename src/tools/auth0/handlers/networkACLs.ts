import { GetNetworkAclsById200Response } from 'auth0';
import DefaultAPIHandler from './default';
import { Asset, Assets } from '../../../types';
import { paginate } from '../client';

// Define NetworkACL type
export type NetworkACL = GetNetworkAclsById200Response;

// Define action types
const BlockAction = {
  type: 'object',
  required: ['block'],
  properties: {
    block: {
      type: 'boolean',
      enum: [true],
    },
  },
  additionalProperties: false,
};

const AllowAction = {
  type: 'object',
  required: ['allow'],
  properties: {
    allow: {
      type: 'boolean',
      enum: [true],
    },
  },
  additionalProperties: false,
};

const LogAction = {
  type: 'object',
  required: ['log'],
  properties: {
    log: {
      type: 'boolean',
      enum: [true],
    },
  },
  additionalProperties: false,
};

const RedirectAction = {
  type: 'object',
  required: ['redirect', 'redirect_uri'],
  properties: {
    redirect: {
      type: 'boolean',
      enum: [true],
    },
    redirect_uri: {
      type: 'string',
      minLength: 1,
      maxLength: 2000,
    },
  },
  additionalProperties: false,
};

// Define MatchSchema
const MatchSchema = {
  type: 'object',
  properties: {
    anonymous_proxy: {
      type: 'boolean',
      description: 'Anonymous Proxy as reported by GeoIP',
    },
    asns: {
      type: 'array',
      items: {
        type: 'integer',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    geo_country_codes: {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    geo_subdivision_codes: {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    ipv4_cidrs: {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    ipv6_cidrs: {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    ja3_fingerprints: {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    ja4_fingerprints: {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
    user_agents: {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    },
  },
  additionalProperties: false,
};

export const schema = {
  type: 'array',
  description: 'List of network ACL configurations',
  items: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        maxLength: 255,
      },
      active: {
        type: 'boolean',
      },
      priority: {
        type: 'number',
        minimum: 1,
        maximum: 10,
      },
      rule: {
        anyOf: [
          {
            type: 'object',
            required: ['action', 'scope', 'match'],
            properties: {
              action: {
                type: 'object',
                anyOf: [BlockAction, AllowAction, LogAction, RedirectAction],
              },
              match: MatchSchema,
              not_match: MatchSchema,
              scope: {
                enum: ['management', 'authentication', 'tenant'],
                type: 'string',
              },
            },
            additionalProperties: false,
          },
          {
            type: 'object',
            required: ['action', 'scope', 'not_match'],
            properties: {
              action: {
                type: 'object',
                anyOf: [BlockAction, AllowAction, LogAction, RedirectAction],
              },
              not_match: MatchSchema,
              match: MatchSchema,
              scope: {
                enum: ['management', 'authentication', 'tenant'],
                type: 'string',
              },
            },
            additionalProperties: false,
          },
        ],
      },
    },
    additionalProperties: false,
  },
};

export default class NetworkACLsHandler extends DefaultAPIHandler {
  existing: NetworkACL[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'networkACLs',
      id: 'id',
      identifiers: ['id', 'priority'],
      stripCreateFields: ['created_at', 'updated_at'],
      stripUpdateFields: ['created_at', 'updated_at'],
    });
  }

  async getType(): Promise<Asset | null> {
    if (this.existing) {
      return this.existing;
    }

    try {
      const networkACLs = await paginate<NetworkACL>(this.client.networkAcls.getAll, {
        paginate: true,
        include_totals: true,
      });

      this.existing = networkACLs;
      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }
      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { networkACLs } = assets;

    // Do nothing if not set
    if (!networkACLs) return;

    const changes = await this.calcChanges(assets);

    await super.processChanges(assets, {
      ...changes,
    });
  }
}
