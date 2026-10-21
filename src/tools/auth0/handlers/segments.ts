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
      // Read-only: the API decides the type. 'auth0' segments are Auth0-managed, 'self' are
      // customer-defined. Present on export; stripped from payloads.
      type: { type: 'string', enum: ['auth0', 'self'] },
      // Lifecycle status. Not settable on create (a segment is born 'active'); archiving happens
      // on update and is terminal.
      status: { type: 'string', enum: ['active', 'archived'] },
      // Ordered list of match / not_match rules. A segment matches if any rule matches.
      rules: {
        type: 'array',
        items: { type: 'object' },
      },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
    required: ['name', 'rules'],
  },
};

export type Segment = Management.Segment;

export default class SegmentsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'segments',
      identifiers: ['id', 'name'],
      // created_at/updated_at/type are read-only; status is not accepted on create (a segment is
      // created 'active', archiving happens via update).
      stripCreateFields: ['id', 'created_at', 'updated_at', 'type', 'status'],
      stripUpdateFields: ['created_at', 'updated_at', 'type'],
      functions: {
        create: (data) => this.client.experimentation.segments.create(data),
        update: (id: string, data) => {
          // An archived segment is terminal and immutable: the API rejects any field edit with
          // segment_archived. Since deploy-cli issues an update for every matched asset,
          // re-importing a config that still contains an archived segment would fail on every run.
          // Send only the status (an accepted idempotent no-op) so re-imports stay clean.
          const existing = (this.existing || []).find((segment) => segment.id === id);
          if (existing && existing.status === 'archived') {
            // Those skipped edits are otherwise invisible (the run still logs "Updated"), so warn
            // when the config actually diverges from the archived segment, including an attempt to
            // un-archive it, which the API does not allow.
            if (this.archivedSegmentHasIgnoredChanges(existing, data)) {
              log.warn(
                `Segment "${existing.name}" is archived and immutable; its configuration changes are ignored. Create a new segment instead.`
              );
            }
            return this.client.experimentation.segments.update(id, { status: 'archived' });
          }
          return this.client.experimentation.segments.update(id, data);
        },
        delete: (id: string) => this.client.experimentation.segments.delete(id),
      },
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  // Whether the desired state differs from the archived segment already on the tenant. Only used
  // to decide whether to warn that the edit will be ignored; it does not change what is sent.
  // Compares the user-editable fields and treats any non-archived target status (an un-archive
  // attempt) as a divergence, since the API does not allow leaving the archived state.
  private archivedSegmentHasIgnoredChanges(existing: Asset, data: Asset): boolean {
    if (data.status !== undefined && data.status !== 'archived') return true;
    if (data.name !== undefined && data.name !== existing.name) return true;
    if (data.description !== undefined && data.description !== existing.description) return true;
    if (data.rules !== undefined && !isEqual(data.rules, existing.rules)) return true;
    return false;
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;

    try {
      const segments: Asset[] = [];
      let page = await this.client.experimentation.segments.list();
      segments.push(...page.data);
      while (page.hasNextPage()) {
        page = await page.getNextPage();
        segments.push(...page.data);
      }

      // Auth0-managed segments (type 'auth0') are provisioned automatically and cannot be
      // created, updated or deleted, so exclude them. Only customer-defined ('self') segments
      // are synced.
      this.existing = segments
        .filter((segment) => segment.type !== 'auth0')
        .map((segment) => {
          // Drop read-only / API-generated fields from the exported shape so they do not land in
          // users' config repos, churn on every export, or surface as phantom diffs in dry-run.
          // type is always 'self' here (managed segments are filtered out above) and is read-only.
          const portable: Asset = { ...segment };
          delete portable.created_at;
          delete portable.updated_at;
          delete portable.type;
          return portable;
        });
      return this.existing;
    } catch (err) {
      // A missing-scope 403 ("Insufficient scope") is handled by the base load() wrapper
      // (detectInsufficientScopeError), which surfaces a clear "missing scopes" warning naming the
      // required scope. Let it propagate instead of masking it as a missing entitlement.
      if (err.statusCode === 403 && err.message?.includes('Insufficient scope')) {
        throw err;
      }
      // Experiment Center is entitlement-gated. On a tenant without the entitlement the endpoints
      // answer 403/404 (or 501 where unimplemented); treat that as "no segments to manage" and
      // skip the resource rather than failing the whole export/import.
      if (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 501) {
        log.debug('Experiment Center is not enabled for this tenant; skipping segments.');
        return null;
      }
      throw err;
    }
  }

  @order('81')
  async processChanges(assets: Assets): Promise<void> {
    const { segments } = assets;
    if (!segments) return;
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
