import { Management } from 'auth0';
import { isNil, omitBy } from 'lodash';
import DefaultAPIHandler, { order } from './default';
import ValidationError from '../../validationError';
import {
  duplicateItems,
  isDryRun,
  isUnresolvedPlaceholder,
  portalHasForms,
  resolvePortalReferences,
  withoutSecret,
} from '../../utils';
import { paginate } from '../client';
import constants from '../../constants';
import { getObjectDifferences } from '../../calculateDryRunChanges';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import log from '../../../logger';

const { PORTALS_LIST_LIMIT } = constants;

// Optional blocks the API clears only when sent as null; omitting them leaves them unchanged.
const CLEARABLE_FIELDS = ['navigation', 'pages', 'custom_code'];

const DEPRECATED_SIDEBAR_TYPES = [
  'sidebar:component:auth0:external_link',
  'sidebar:component:auth0:internal_link',
];

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      // Unique per tenant; used as the matching key. The name is not unique.
      slug: { type: 'string' },
      name: { type: 'string', minLength: 1, maxLength: 150 },
      client: {
        type: 'object',
        required: ['token_endpoint_auth_method', 'client_id'],
        properties: {
          token_endpoint_auth_method: { type: 'string' },
          client_id: { type: 'string' },
          // Write-only: never exported. Required when creating a portal.
          client_secret: { type: 'string' },
        },
      },
      // An empty value (YAML `navigation:` or JSON null) is treated like a missing block.
      navigation: { type: ['object', 'null'] },
      pages: { type: ['object', 'null'] },
      custom_code: { type: ['object', 'null'] },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
    required: ['slug', 'name'],
  },
};

export type Portal = Management.Portal;

// An unmapped ##KEYWORD## is stripped before the API call, so it does not count as a secret.
const hasSecret = (portal: Asset): boolean =>
  !!portal.client?.client_secret && !isUnresolvedPlaceholder(portal.client.client_secret);

const unavailableMessage =
  'Universal Portals are not enabled for this tenant (or the environment); skipping portals.';

export default class PortalsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  // Set when the list hit the API limit, so some portals on the tenant are not visible.
  private listCapped = false;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'portals',
      identifiers: ['id', 'slug'],
      stripCreateFields: ['id', 'created_at', 'updated_at'],
      stripUpdateFields: ['created_at', 'updated_at'],
      // The secret is write-only, so a configured one can never match the tenant's copy.
      ignoreDryRunFields: ['client_secret'],
      functions: {
        create: (data: Asset) => this.createPortal(data),
        update: (id: string, data: Asset) =>
          this.client.portals.update(id, this.buildUpdatePayload(id, data)),
        delete: (id: string) => this.client.portals.delete(id),
      },
    });
  }

  objString(item: Asset): string {
    return super.objString({ slug: item.slug, name: item.name });
  }

  // Names are not unique, so the dry-run preview also shows the slug.
  getResourceName(item: Asset): string {
    return item.name ? `${item.name} (${item.slug})` : item.slug;
  }

  // A slug conflict on create means the portal exists but was not matched; when the list was
  // capped it is one the API did not return, so say that instead of the raw 409.
  private async createPortal(data: Asset): Promise<Asset> {
    try {
      return await this.client.portals.create(omitBy(data, isNil) as any);
    } catch (err) {
      if (err.statusCode !== 409) throw err;
      const reason = this.listCapped
        ? `, but it is not among the first ${PORTALS_LIST_LIMIT} portals the API lists, so it cannot be matched or updated`
        : '';
      throw new Error(
        `A portal with slug "${data.slug}" already exists on the tenant${reason}.\n${err.message}`
      );
    }
  }

  private isDeleteAllowed(): boolean {
    return (
      this.config('AUTH0_ALLOW_DELETE') === 'true' || this.config('AUTH0_ALLOW_DELETE') === true
    );
  }

  // The client block must carry the write-only secret on every PATCH, so it is only sent when the
  // config supplies one. Warns when that leaves a client_id change unapplied.
  private isClientSent(portal: Asset, existing: Asset | undefined, warn = true): boolean {
    if (hasSecret(portal)) return true;
    if (warn && portal.client && existing?.client?.client_id !== portal.client.client_id) {
      log.warn(
        `Portal "${portal.slug}": client_id changed but no client.client_secret is configured; the client is left unchanged.`
      );
    }
    return false;
  }

  // A block left out of the config is not managed. One set empty (null) in the config is cleared,
  // only with deletes on; otherwise it is kept with a warning. Returns the blocks to clear.
  private blocksToClear(portal: Asset, existing: Asset | undefined, warn = true): string[] {
    const emptied = CLEARABLE_FIELDS.filter((field) => portal[field] === null && existing?.[field]);
    if (this.isDeleteAllowed()) return emptied;
    if (!warn) return [];
    emptied.forEach((field) =>
      log.warn(
        `Portal "${portal.slug}": ${field} is empty in the config but set on the tenant. Set 'AUTH0_ALLOW_DELETE' to true to clear it.`
      )
    );
    return [];
  }

  private buildUpdatePayload(id: string, data: Asset): any {
    const existing = (this.existing || []).find((portal) => portal.id === id);
    const payload = omitBy(data, isNil);
    if (!this.isClientSent(data, existing)) delete payload.client;
    this.blocksToClear(data, existing).forEach((field) => {
      payload[field] = null;
    });
    return payload;
  }

  // The secret is write-only and required by the API on create, so fail before any call is made.
  private assertSecretsPresent(toCreate: Asset[]): void {
    const missing = toCreate.filter((portal) => !hasSecret(portal));
    if (missing.length === 0) return;
    const slugs = missing.map((portal) => `"${portal.slug}"`).join(', ');
    // At the list limit a portal that already exists may just not be listed.
    const capped = this.listCapped
      ? ` The API lists at most ${PORTALS_LIST_LIMIT} portals, so if one of these already exists it is beyond that limit and cannot be matched or updated.`
      : '';
    throw new ValidationError(
      `Cannot create portal(s) ${slugs} without client.client_secret. The secret is write-only and never exported; add it to the configuration, e.g. with a ##KEYWORD## mapping defined in AUTH0_KEYWORD_REPLACE_MAPPINGS.${capped}`
    );
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;

    let summaries: Management.PortalSummary[];
    try {
      ({ portals: summaries } = await this.client.portals.list());
    } catch (err) {
      // A missing-scope 403 is reported by the base load() wrapper; let it propagate.
      if (err.statusCode === 403 && err.message?.includes('Insufficient scope')) throw err;
      // Gated feature: any other 403 (or 404 where the endpoint is absent) means nothing to manage.
      if (err.statusCode === 403 || err.statusCode === 404) {
        log.debug(unavailableMessage);
        return null;
      }
      throw err;
    }

    this.listCapped = summaries.length >= PORTALS_LIST_LIMIT;
    if (this.listCapped) {
      log.warn(
        `The tenant has ${summaries.length} portals and the API lists at most ${PORTALS_LIST_LIMIT} without pagination. Portals beyond that are not exported or managed.`
      );
    }

    // The list returns summaries only, so fetch each portal for its full definition.
    const portals = await this.client.pool
      .addEachTask({
        data: summaries,
        generator: ({ id }) => this.client.portals.get(id),
      })
      .promise();

    // Drop read-only timestamps so they do not churn exports or show up as dry-run diffs.
    this.existing = portals.map(({ created_at, updated_at, ...portal }) => portal);
    return this.existing;
  }

  async validate(assets: Assets): Promise<void> {
    const { portals } = assets;
    if (!Array.isArray(portals)) return;

    // Names are not unique in the API, so only slugs and ids must be.
    const duplicateSlugs = duplicateItems(portals, 'slug');
    if (duplicateSlugs.length > 0) {
      throw new ValidationError(
        `There are multiple portals with the same slug: ${duplicateSlugs
          .map((dups) => dups[0].slug)
          .join(', ')}. Slugs must be unique.`
      );
    }

    // Runs before both the dry run and the import, so the warning shows in both.
    portals.forEach((portal) => {
      const components = portal.navigation?.sidebar?.components;
      const deprecated = (Array.isArray(components) ? components : [])
        .map((component) => component?.type)
        .filter((type) => DEPRECATED_SIDEBAR_TYPES.includes(type));
      if (deprecated.length > 0) {
        log.warn(
          `Portal "${portal.slug}" uses deprecated sidebar component types (${[
            ...new Set(deprecated),
          ].join(
            ', '
          )}). Use the ":v2" types instead; they rename config.url to config.href and config.to to config.page_slug.`
        );
      }
    });

    const duplicateIds = duplicateItems(portals, 'id');
    if (duplicateIds.length > 0) {
      throw new ValidationError(
        `There are multiple portals with the same id: ${duplicateIds
          .map((dups) => dups[0].id)
          .join(', ')}.`
      );
    }

    // Checked here, before any handler writes, so a full import is not left half applied.
    // Portals whose slug is not on the tenant will be created and need a secret.
    if (portals.every(hasSecret)) return;
    const existing = await this.getType();
    if (existing === null) return;
    // Matched like the import: by id, then by slug.
    const isOnTenant = (portal: Asset) =>
      existing.some((item) => (portal.id && item.id === portal.id) || item.slug === portal.slug);
    this.assertSecretsPresent(portals.filter((portal) => !isOnTenant(portal)));
  }

  // Empty local fields count as missing, so an empty block that clears nothing is no difference.
  private onlyClientDiffers(portal: Asset, remote: Asset): boolean {
    const { client: _localClient, ...local } = portal;
    const { client: _remoteClient, ...rest } = remote;
    return (
      getObjectDifferences(
        omitBy(local, isNil),
        rest,
        '',
        this.type,
        this.getEffectiveIgnoreDryRunFields()
      ).length === 0
    );
  }

  // The dry-run diff only compares fields set locally and ignores the write-only secret, so add
  // what the import sends anyway: a cleared block and a configured secret. A client_id-only
  // difference is not applied without a secret, so it is not an update.
  private adjustDryRunUpdates(
    portals: Asset[],
    existing: Asset[],
    changes: CalculatedChanges,
    warn: boolean
  ): CalculatedChanges {
    const update = [...changes.update];
    portals.forEach((portal) => {
      const remote = existing.find((item) => item.slug === portal.slug);
      if (!remote) return;
      const clientSent = this.isClientSent(portal, remote, warn);
      const clearsBlocks = this.blocksToClear(portal, remote, warn).length > 0;
      const index = update.findIndex((item) => item.slug === portal.slug);
      if (index !== -1 && !clientSent && !clearsBlocks && this.onlyClientDiffers(portal, remote)) {
        update.splice(index, 1);
      } else if (index === -1 && (clientSent || clearsBlocks)) {
        update.push({ ...portal, id: remote.id });
      }
    });
    return { ...changes, update };
  }

  // Mirrors processChanges: the same updates.
  async dryRunChanges(assets: Assets): Promise<CalculatedChanges> {
    const { portals } = assets;
    if (!portals) return super.dryRunChanges(assets);

    const existing = await this.getType();
    if (existing === null) {
      log.warn(unavailableMessage);
      return { del: [], create: [], conflicts: [], update: [] };
    }

    const diff = await super.dryRunChanges(assets);
    const changes = this.adjustDryRunUpdates(portals, existing, diff, true);

    // The preview is printed, so keep the configured secret out of it.
    return {
      ...changes,
      create: changes.create.map(withoutSecret),
      update: changes.update.map(withoutSecret),
    };
  }

  // Applying after a preview diffs with the dry-run calculation, so it needs the same updates.
  // Warnings come from buildUpdatePayload, as in a plain import.
  async calcChanges(assets: Assets): Promise<CalculatedChanges> {
    const changes = await super.calcChanges(assets);
    if (!isDryRun(this.config) || !assets.portals) return changes;
    const existing = await this.getType();
    return existing ? this.adjustDryRunUpdates(assets.portals, existing, changes, false) : changes;
  }

  @order('95')
  async processChanges(assets: Assets): Promise<void> {
    const { portals } = assets;
    if (!portals) return;

    if ((await this.getType()) === null) {
      log.warn(unavailableMessage);
      return;
    }

    // Clients and forms run first, so ones created in this import can be referenced by name.
    const clients = portals.some((portal) => portal.client?.client_id)
      ? await paginate<Management.Client>(this.client.clients.list, {
          paginate: true,
          include_totals: true,
        })
      : [];
    const forms = portals.some(portalHasForms)
      ? await paginate<Management.FormSummary>(this.client.forms.list, { paginate: true })
      : [];
    const resolved = resolvePortalReferences(portals, clients, forms);

    await super.processChanges(assets, await this.calcChanges({ ...assets, portals: resolved }));
  }
}
