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

  async getType(): Promise<Asset[]> {
    if (this.existing) return this.existing;

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
    this.existing = segments.filter((segment) => segment.type !== 'auth0');
    return this.existing;
  }

  @order('81')
  async processChanges(assets: Assets): Promise<void> {
    const { segments } = assets;
    if (!segments) return;
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
