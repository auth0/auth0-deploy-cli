import { Management } from 'auth0';
import DefaultAPIHandler from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import { isDryRun } from '../../utils';
import log from '../../../logger';

export type RateLimitPolicyConfiguration = Management.RateLimitPolicyConfiguration;
export type RateLimitPolicy = Management.RateLimitPolicy;

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        enum: Object.values(Management.RateLimitPolicyResourceEnum),
      },
      consumer: {
        type: 'string',
        enum: Object.values(Management.RateLimitPolicyConsumerEnum),
      },
      consumer_selector: {
        type: 'string',
      },
      configuration: {
        type: 'object',
        oneOf: [
          {
            required: ['action'],
            properties: {
              action: { type: 'string', enum: ['allow'] },
            },
            additionalProperties: false,
          },
          {
            required: ['action', 'limit'],
            properties: {
              action: { type: 'string', enum: ['block', 'log'] },
              limit: { type: 'number' },
            },
            additionalProperties: false,
          },
          {
            required: ['action', 'limit', 'redirect_uri'],
            properties: {
              action: { type: 'string', enum: ['redirect'] },
              limit: { type: 'number' },
              redirect_uri: { type: 'string' },
            },
            additionalProperties: false,
          },
        ],
      },
    },
    required: ['resource', 'consumer', 'consumer_selector', 'configuration'],
  },
};

export default class RateLimitPoliciesHandler extends DefaultAPIHandler {
  existing: RateLimitPolicy[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'rateLimitPolicies',
      id: 'id',
      identifiers: ['id', 'consumer_selector'],
      stripCreateFields: ['id', 'created_at', 'updated_at'],
      stripUpdateFields: [
        'id',
        'resource',
        'consumer',
        'consumer_selector',
        'created_at',
        'updated_at',
      ],
    });
  }

  objString(policy: RateLimitPolicy): string {
    return super.objString({
      consumer_selector: policy.consumer_selector,
      resource: policy.resource,
    });
  }

  async getType(): Promise<Asset | null> {
    if (this.existing) return this.existing;

    try {
      const rateLimitPolicies = await paginate<RateLimitPolicy>(
        this.client.rateLimitPolicies.list,
        { checkpoint: true }
      );
      this.existing = rateLimitPolicies;
      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }
      if (err.statusCode === 403) {
        log.debug(
          'Rate Limit Policies feature is not enabled for this tenant. Please contact Auth0 support to enable this feature.'
        );
        return null;
      }
      throw err;
    }
  }

  async processChanges(assets: Assets): Promise<void> {
    const { rateLimitPolicies } = assets;

    if (!rateLimitPolicies) return;

    const { del, update, create } = await this.calcChanges(assets);

    if (isDryRun(this.config)) {
      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }

    log.debug(
      `Start processChanges for rateLimitPolicies [delete:${del.length}] [update:${update.length}], [create:${create.length}]`
    );

    const changes = [{ del }, { create }, { update }];

    await Promise.all(
      changes.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            await this.deleteRateLimitPolicies(change.del);
            break;
          case change.create && change.create.length > 0:
            await this.createRateLimitPolicies(change.create);
            break;
          case change.update && change.update.length > 0:
            await this.updateRateLimitPolicies(change.update);
            break;
          default:
            break;
        }
      })
    );
  }

  async createRateLimitPolicy(policy: RateLimitPolicy): Promise<RateLimitPolicy> {
    const created = await this.client.rateLimitPolicies.create(policy as any);
    return created as RateLimitPolicy;
  }

  async createRateLimitPolicies(creates: CalculatedChanges['create']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item: RateLimitPolicy) =>
          this.createRateLimitPolicy(item)
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

  async updateRateLimitPolicy(policy: RateLimitPolicy): Promise<void> {
    const { id, configuration } = policy;

    if (!id) {
      throw new Error(`Missing id for ${this.type} ${this.objString(policy)}`);
    }

    await this.client.rateLimitPolicies.update(id, { configuration });
  }

  async updateRateLimitPolicies(updates: CalculatedChanges['update']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item: RateLimitPolicy) =>
          this.updateRateLimitPolicy(item)
            .then(() => {
              this.didUpdate(item);
              this.updated += 1;
            })
            .catch((err) => {
              throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async deleteRateLimitPolicy(policy: RateLimitPolicy): Promise<void> {
    if (!policy.id) {
      throw new Error(`Missing id for ${this.type} ${this.objString(policy)}`);
    }
    await this.client.rateLimitPolicies.delete(policy.id);
  }

  async deleteRateLimitPolicies(data: Asset[]): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: data || [],
          generator: (item: RateLimitPolicy) =>
            this.deleteRateLimitPolicy(item)
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
      log.warn(
        `Detected the following ${
          this.type
        } should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config\n${data
          .map((i) => this.objString(i as RateLimitPolicy))
          .join('\n')}`
      );
    }
  }
}
