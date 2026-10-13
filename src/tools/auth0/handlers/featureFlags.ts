import { Management } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      // Read-only: the API decides the type. 'auth0' flags are Auth0-managed built-ins,
      // 'self' flags are customer-defined. Only present on export; stripped from payloads.
      type: { type: 'string', enum: ['auth0', 'self'] },
      // Lifecycle status. Not settable on create (a flag is always born 'draft');
      // transitions happen on update. Activating a flag requires at least 2 variations.
      status: { type: 'string', enum: ['draft', 'active', 'archived'] },
      parameters: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['string', 'boolean', 'number', 'array', 'object'],
            },
            value: {},
            description: { type: 'string' },
          },
          // The API requires both type and value on every parameter (an empty parameters
          // object is valid, but a declared parameter must carry a value matching its type).
          required: ['type', 'value'],
        },
      },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
    required: ['name', 'parameters'],
  },
};

export type FeatureFlag = Management.FeatureFlag;

export default class FeatureFlagsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'featureFlags',
      identifiers: ['id', 'name'],
      // created_at/updated_at/type are read-only API-generated fields; status is not accepted
      // on create (the flag is created in 'draft', transitions happen via update).
      stripCreateFields: ['id', 'created_at', 'updated_at', 'type', 'status'],
      stripUpdateFields: ['created_at', 'updated_at', 'type'],
      functions: {
        create: (data) => this.client.experimentation.featureFlags.create(data),
        update: (id: string, data) => this.client.experimentation.featureFlags.update(id, data),
        delete: (id: string) => this.client.experimentation.featureFlags.delete(id),
      },
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) return this.existing;

    const featureFlags: Asset[] = [];
    let page = await this.client.experimentation.featureFlags.list();
    featureFlags.push(...page.data);
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      featureFlags.push(...page.data);
    }

    // Auth0-managed built-in flags (type 'auth0', e.g. the passkey enrollment flag) are
    // provisioned automatically on entitled tenants and cannot be created, updated or deleted
    // through the API, so exclude them from management. Only customer-defined ('self') flags
    // are synced.
    this.existing = featureFlags.filter((flag) => flag.type !== 'auth0');
    return this.existing;
  }

  @order('80')
  async processChanges(assets: Assets): Promise<void> {
    const { featureFlags } = assets;
    if (!featureFlags) return;
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
