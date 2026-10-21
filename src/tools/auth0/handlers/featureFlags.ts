import { Management } from 'auth0';
import { isEqual } from 'lodash';
import DefaultAPIHandler, { order } from './default';
import { Asset, Assets } from '../../../types';
import log from '../../../logger';

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
        update: (id: string, data) => {
          // An archived flag is terminal and immutable: the API rejects any field edit with
          // feature_flag_archived. Since deploy-cli issues an update for every matched asset,
          // re-importing a config that still contains an archived flag would fail on every run.
          // Send only the status (an accepted idempotent no-op) so re-imports stay clean.
          const existing = (this.existing || []).find((flag) => flag.id === id);
          if (existing && existing.status === 'archived') {
            // Those skipped edits are otherwise invisible (the run still logs "Updated"), so warn
            // when the config actually diverges from the archived flag, including an attempt to
            // un-archive it, which the API does not allow.
            if (this.archivedFlagHasIgnoredChanges(existing, data)) {
              log.warn(
                `Feature flag "${existing.name}" is archived and immutable; its configuration changes are ignored.`
              );
            }
            return this.client.experimentation.featureFlags.update(id, { status: 'archived' });
          }
          return this.client.experimentation.featureFlags.update(id, data);
        },
        delete: (id: string) => this.client.experimentation.featureFlags.delete(id),
      },
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  // Whether the desired state differs from the archived flag already on the tenant. Only used to
  // decide whether to warn that the edit will be ignored; it does not change what is sent.
  // Compares the user-editable fields and treats any non-archived target status (an un-archive
  // attempt) as a divergence, since the API does not allow leaving the archived state.
  private archivedFlagHasIgnoredChanges(existing: Asset, data: Asset): boolean {
    if (data.status !== undefined && data.status !== 'archived') return true;
    if (data.name !== undefined && data.name !== existing.name) return true;
    if (data.description !== undefined && data.description !== existing.description) return true;
    if (data.parameters !== undefined && !isEqual(data.parameters, existing.parameters))
      return true;
    return false;
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
    this.existing = featureFlags
      .filter((flag) => flag.type !== 'auth0')
      .map((flag) => {
        // Drop read-only / API-generated fields from the exported shape so they do not land in
        // users' config repos, churn on every export, or surface as phantom diffs in dry-run.
        // type is always 'self' here (managed flags are filtered out above) and is read-only.
        const portable: Asset = { ...flag };
        delete portable.created_at;
        delete portable.updated_at;
        delete portable.type;
        return portable;
      });
    return this.existing;
  }

  @order('80')
  async processChanges(assets: Assets): Promise<void> {
    const { featureFlags } = assets;
    if (!featureFlags) return;
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
