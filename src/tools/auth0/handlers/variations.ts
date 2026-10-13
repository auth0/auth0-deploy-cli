import { Management } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import { Asset, Assets } from '../../../types';
import ValidationError from '../../validationError';
import { convertJsonToString } from '../../utils';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      // Portable reference to the parent feature flag (resolved to feature_flag_id at import).
      feature_flag_name: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      // Config overrides; keys must be parameters on the parent flag. {} is the control/baseline.
      overrides: { type: 'object' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
    required: ['feature_flag_name', 'name', 'overrides'],
  },
};

// On disk a variation references its parent flag by portable name rather than the
// tenant-specific feature_flag_id.
export type Variation = Omit<Management.Variation, 'feature_flag_id'> & {
  feature_flag_name: string;
  feature_flag_id?: string;
};

export default class VariationsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  private flagNameToId: { [name: string]: string } = {};

  // Serializes writes targeting the same feature flag. The deploy pool runs variation writes
  // concurrently, but the API races when multiple variations on one flag are written at once,
  // so each flag's writes are chained while different flags still proceed in parallel.
  private flagLocks: { [flagId: string]: Promise<unknown> } = {};

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'variations',
      // Variation names are unique only within a parent flag, so match on the composite
      // (feature_flag_name, name). id is kept as a same-tenant fast path. The matcher
      // supports nested-array identifiers at runtime; the declared type is string[].
      identifiers: ['id', ['feature_flag_name', 'name']] as unknown as string[],
      // feature_flag_name is kept in the payload so the write functions can resolve the parent
      // flag id; it is stripped inside each function before the API call. feature_flag_id is a
      // read-only, tenant-specific field and is never sent.
      stripCreateFields: ['id', 'created_at', 'updated_at', 'feature_flag_id'],
      stripUpdateFields: ['created_at', 'updated_at', 'feature_flag_id'],
      functions: {
        create: async (data) => {
          const flagId = await this.resolveFlagId(data.feature_flag_name);
          const payload = { ...data };
          delete payload.feature_flag_name;
          return this.withFlagLock(flagId, () =>
            this.client.experimentation.featureFlags.variations.create(flagId, payload)
          );
        },
        update: async (id: string, data) => {
          const flagId = await this.resolveFlagId(data.feature_flag_name);
          const payload = { ...data };
          delete payload.feature_flag_name;
          return this.withFlagLock(flagId, () =>
            this.client.experimentation.featureFlags.variations.update(flagId, id, payload)
          );
        },
        delete: async (id: string) => {
          // Delete items come from `existing`, which carries feature_flag_name.
          const existing = (this.existing || []).find((v) => v.id === id);
          const flagId = await this.resolveFlagId(existing?.feature_flag_name);
          return this.withFlagLock(flagId, () =>
            this.client.experimentation.featureFlags.variations.delete(flagId, id)
          );
        },
      },
    });
  }

  // Lists every feature flag and (re)builds the name -> id map used to resolve a variation's
  // parent flag. Returns the flags so callers can reuse them.
  private async listFlags(): Promise<Asset[]> {
    const flags: Asset[] = [];
    let page = await this.client.experimentation.featureFlags.list();
    flags.push(...page.data);
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      flags.push(...page.data);
    }
    this.flagNameToId = flags.reduce((map, flag) => {
      map[flag.name] = flag.id;
      return map;
    }, {});
    return flags;
  }

  // Chains an operation after any in-flight operation on the same flag, so same-flag writes
  // never overlap on the server. The chain ignores prior rejections so one failure does not
  // block subsequent operations on that flag.
  private withFlagLock<T>(flagId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.flagLocks[flagId] || Promise.resolve();
    const next = previous.catch(() => undefined).then(fn);
    this.flagLocks[flagId] = next;
    return next;
  }

  private async resolveFlagId(flagName: string | undefined): Promise<string> {
    if (!flagName) {
      throw new Error('Variation is missing feature_flag_name; cannot resolve its parent flag.');
    }
    // A flag created earlier in the same deploy run may not be in the cached map yet (list
    // read-after-write lag), so refresh once before giving up.
    if (!this.flagNameToId[flagName]) {
      await this.listFlags();
    }
    const flagId = this.flagNameToId[flagName];
    if (!flagId) {
      throw new Error(
        `Feature flag "${flagName}" not found in the target tenant. Create the feature flag before its variations.`
      );
    }
    return flagId;
  }

  objString(item: Asset): string {
    // On create the API echoes feature_flag_id rather than the portable name; fall back so
    // log lines stay readable.
    const flag = item.feature_flag_name || item.feature_flag_id || 'unknown-flag';
    return `${flag}/${item.name}`;
  }

  async validate(assets: Assets): Promise<void> {
    const variations = assets.variations;
    if (!Array.isArray(variations)) return;

    // A variation name must be unique within its parent flag (not globally), so the base
    // name-uniqueness check is replaced with a per-flag one.
    const seen = new Set<string>();
    const duplicates: string[] = [];
    variations.forEach((variation) => {
      const key = `${variation.feature_flag_name}/${variation.name}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    });
    if (duplicates.length > 0) {
      throw new ValidationError(
        `There are multiple variations with the same feature flag and name combinations: ${convertJsonToString(
          duplicates
        )}. Variation names must be unique within a feature flag.`
      );
    }
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) return this.existing;

    // List every feature flag to build the name -> id map and to walk each flag's variations.
    const flags = await this.listFlags();

    const variations: Asset[] = [];
    // Only customer-defined flags are managed; Auth0-managed built-ins (and their variations)
    // are provisioned automatically and cannot be modified, so skip them.
    for (const flag of flags.filter((flag) => flag.type !== 'auth0')) {
      // eslint-disable-next-line no-await-in-loop
      const response = await this.client.experimentation.featureFlags.variations.list(flag.id);
      (response.variations || []).forEach((variation) => {
        // Drop the tenant-specific feature_flag_id in favor of the portable flag name.
        const portable: Asset = { ...variation, feature_flag_name: flag.name };
        delete portable.feature_flag_id;
        variations.push(portable);
      });
    }

    this.existing = variations;
    return this.existing;
  }

  @order('81')
  async processChanges(assets: Assets): Promise<void> {
    const { variations } = assets;
    if (!variations) return;
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
