import { GetNetworkAclsById200Response } from 'auth0';
import DefaultAPIHandler from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';

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
    required: ['description', 'active', 'priority', 'rule'],
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
      identifiers: ['id', 'priority', 'active', 'rule'],
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
      if (err.statusCode === 403) {
        log.debug(
          'Tenant ACL Management is not enabled for this tenant. Please verify `scope` or contact Auth0 support to enable this feature.'
        );
        return null;
      }
      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { networkACLs } = assets;

    // Do nothing if not set
    if (!networkACLs) return;

    const { del, update, create } = await this.calcChanges(assets);

    log.debug(
      `Start processChanges for network ACLs [delete:${del.length}] [update:${update.length}], [create:${create.length}]`
    );

    const changes = [{ del: del }, { create: create }, { update: update }];

    await Promise.all(
      changes.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            await this.deleteNetworkACLs(change.del || []);
            break;
          case change.create && change.create.length > 0:
            await this.createNetworkACLs(change.create);
            break;
          case change.update && change.update.length > 0:
            if (change.update) await this.updateNetworkACLs(change.update);
            break;
          default:
            break;
        }
      })
    );
  }

  async createNetworkACL(acl: NetworkACL): Promise<Asset> {
    const { data: created } = await this.client.networkAcls.create(acl);
    return created;
  }

  async createNetworkACLs(creates: CalculatedChanges['create']) {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item: NetworkACL) =>
          this.createNetworkACL(item)
            .then((data) => {
              this.didCreate(data);
              this.created += 1;
            })
            .catch((err) => {
              throw new Error(`Problem creating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async updateNetworkACL(acl: NetworkACL) {
    const { id, ...updateParams } = acl;
    const updated = await this.client.networkAcls.update({ id }, updateParams);
    return updated;
  }

  async updateNetworkACLs(updates: CalculatedChanges['update']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item: NetworkACL) =>
          this.updateNetworkACL(item)
            .then((data) => {
              this.didUpdate(data);
              this.updated += 1;
            })
            .catch((err) => {
              throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async deleteNetworkACL(acl: NetworkACL): Promise<void> {
    await this.client.networkAcls.delete({ id: acl.id });
  }

  async deleteNetworkACLs(data: Asset[]): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: data || [],
          generator: (item: NetworkACL) =>
            this.deleteNetworkACL(item)
              .then(() => {
                this.didDelete(item);
                this.deleted += 1;
              })
              .catch((err) => {
                throw new Error(`Problem deleting ${this.type} ${this.objString(item)}\n${err}`);
              }),
        })
        .promise();
    } else {
      log.warn(`Detected the following ${
        this.type
      } should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${data.map((i) => this.objString(i)).join('\n')}`);
    }
  }
}
