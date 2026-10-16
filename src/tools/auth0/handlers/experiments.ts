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
      // Portable reference to the parent feature flag (resolved to feature_flag_id at import).
      feature_flag_name: { type: 'string' },
      authentication_flow: {
        type: 'string',
        enum: [
          'authentication',
          'mfa_enrollment',
          'mfa_challenge',
          'password_reset',
          'passkey_enrollment',
          'all',
        ],
      },
      // Required on create (POST /experiments): the API no longer defaults it.
      allocation_strategy: { type: 'string', enum: ['percentage', 'segment'] },
      // Applies only to Auth0-managed flags; rejected for customer-defined flags.
      default_config: { type: 'string', enum: ['tenant', 'flag'] },
      allocations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            // Portable references (resolved to variation_id / segment_id at import).
            variation_name: { type: 'string' },
            segment_name: { type: 'string' },
            is_control: { type: 'boolean' },
            weight: { type: 'number' },
            priority: { type: 'number' },
            is_fallback: { type: 'boolean' },
          },
          required: ['variation_name', 'is_control'],
        },
      },
      levels: { type: 'array', items: { type: 'number' } },
      // Lifecycle status. Not settable on create (a experiment is born 'draft'); transitions
      // happen on update.
      status: {
        type: 'string',
        enum: ['draft', 'active', 'paused', 'completed', 'archived'],
      },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
    required: ['name', 'feature_flag_name', 'authentication_flow', 'allocation_strategy'],
  },
};

export type Experiment = Management.GetExperimentResponseContent;

// Read-only / tenant-specific fields removed from the exported config.
const READ_ONLY_FIELDS = [
  'feature_flag_id',
  'feature_flag_snapshot',
  'is_valid',
  'editable_fields',
  'current_level',
  'started_at',
  'ended_at',
];

export default class ExperimentsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  private flagNameToId: { [name: string]: string } = {};

  private segmentNameToId: { [name: string]: string } = {};

  private variationNameToIdByFlag: { [flagId: string]: { [name: string]: string } } = {};

  // Current server state per existing experiment, captured in getType. Used by the update path
  // to only send fields the API still allows at the experiment's current lifecycle status
  // (editable_fields is the API's own response-time computation of what is mutable).
  private stateById: { [id: string]: { status: string; editableFields: string[] } } = {};

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'experiments',
      identifiers: ['id', 'name'],
      functions: {
        create: async (data) => {
          const payload = await this.toCreatePayload(data);
          return this.client.experimentation.experiments.create(
            payload as unknown as Management.CreateExperimentRequestContent
          );
        },
        update: async (id: string, data) => {
          const payload = await this.toUpdatePayload(id, data);
          return this.client.experimentation.experiments.update(
            id,
            payload as unknown as Management.UpdateExperimentRequestParameters
          );
        },
        delete: (id: string) => this.client.experimentation.experiments.delete(id),
      },
    });
  }

  objString(item: Asset): string {
    return super.objString(item.name);
  }

  // --- name -> id resolution (write path) --------------------------------------------------

  private async listFlags(): Promise<void> {
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
  }

  private async listSegments(): Promise<void> {
    const segments: Asset[] = [];
    let page = await this.client.experimentation.segments.list();
    segments.push(...page.data);
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      segments.push(...page.data);
    }
    this.segmentNameToId = segments.reduce((map, segment) => {
      map[segment.name] = segment.id;
      return map;
    }, {});
  }

  private async resolveFlagId(flagName: string | undefined): Promise<string> {
    if (!flagName) {
      throw new Error('Experiment is missing feature_flag_name; cannot resolve its feature flag.');
    }
    // A flag created earlier in the same run may lag the list, so refresh once on a miss.
    if (!this.flagNameToId[flagName]) await this.listFlags();
    const flagId = this.flagNameToId[flagName];
    if (!flagId) {
      throw new Error(
        `Feature flag "${flagName}" not found in the target tenant. Create the feature flag before the experiment.`
      );
    }
    return flagId;
  }

  private async resolveSegmentId(segmentName: string): Promise<string> {
    if (!this.segmentNameToId[segmentName]) await this.listSegments();
    const segmentId = this.segmentNameToId[segmentName];
    if (!segmentId) {
      throw new Error(
        `Segment "${segmentName}" not found in the target tenant. Create the segment before the experiment.`
      );
    }
    return segmentId;
  }

  private async resolveVariationId(flagId: string, variationName: string): Promise<string> {
    const load = async (): Promise<void> => {
      const response = await this.client.experimentation.featureFlags.variations.list(flagId);
      this.variationNameToIdByFlag[flagId] = (response.variations || []).reduce(
        (map, variation) => {
          map[variation.name] = variation.id;
          return map;
        },
        {}
      );
    };
    if (!this.variationNameToIdByFlag[flagId]) await load();
    if (!this.variationNameToIdByFlag[flagId][variationName]) await load(); // refresh once on a miss
    const variationId = this.variationNameToIdByFlag[flagId][variationName];
    if (!variationId) {
      throw new Error(
        `Variation "${variationName}" not found on feature flag for experiment allocation. Create the variation before the experiment.`
      );
    }
    return variationId;
  }

  private async buildAllocations(
    flagId: string,
    allocations: Asset[] | undefined
  ): Promise<Asset[] | undefined> {
    if (!allocations) return undefined;
    return Promise.all(
      allocations.map(async (allocation) => {
        const item: Asset = {
          variation_id: await this.resolveVariationId(flagId, allocation.variation_name),
          is_control: allocation.is_control,
        };
        if (allocation.weight !== undefined) item.weight = allocation.weight;
        if (allocation.segment_name !== undefined) {
          item.segment_id = await this.resolveSegmentId(allocation.segment_name);
        }
        if (allocation.priority !== undefined) item.priority = allocation.priority;
        if (allocation.is_fallback !== undefined) item.is_fallback = allocation.is_fallback;
        return item;
      })
    );
  }

  private async toCreatePayload(data: Asset): Promise<Asset> {
    const flagId = await this.resolveFlagId(data.feature_flag_name);
    const payload: Asset = {
      name: data.name,
      feature_flag_id: flagId,
      authentication_flow: data.authentication_flow,
    };
    if (data.description !== undefined) payload.description = data.description;
    if (data.default_config !== undefined) payload.default_config = data.default_config;
    if (data.allocation_strategy !== undefined)
      payload.allocation_strategy = data.allocation_strategy;
    if (data.levels !== undefined) payload.levels = data.levels;
    const allocations = await this.buildAllocations(flagId, data.allocations);
    if (allocations !== undefined) payload.allocations = allocations;
    // status is not accepted on create (the experiment is born 'draft').
    return payload;
  }

  private async toUpdatePayload(id: string, data: Asset): Promise<Asset> {
    // `id` comes from the handler's update function (the base strips it from `data`).
    const state = this.stateById[id];
    const currentStatus = state?.status;

    // Once an experiment is activated its configuration snapshot is frozen: the API rejects any
    // field edit with experiment_snapshot_frozen ("clone it to make changes") and rejects an
    // empty body, so the only accepted update is a status value. Send status alone, which also
    // performs lifecycle transitions (e.g. active -> paused) and is an accepted no-op when the
    // status is unchanged. Config and allocation edits to an activated experiment are not
    // possible through this API (it requires cloning) and so are intentionally not sent.
    if (currentStatus && currentStatus !== 'draft') {
      const target = data.status && data.status !== 'draft' ? data.status : currentStatus;
      return { status: target };
    }

    // Draft experiment (not yet frozen): field edits are allowed, gated by the API's
    // editable_fields (which, notably, omits the create-only authentication_flow). A transition
    // off draft is applied alongside the edits (the API applies edits first, then the transition).
    const editable: string[] | null = state ? state.editableFields : null;
    const canEdit = (field: string): boolean => !editable || editable.includes(field);

    const payload: Asset = {};
    if (data.name !== undefined && canEdit('name')) payload.name = data.name;
    if (data.description !== undefined && canEdit('description'))
      payload.description = data.description;
    if (data.authentication_flow !== undefined && canEdit('authentication_flow'))
      payload.authentication_flow = data.authentication_flow;
    if (data.default_config !== undefined && canEdit('default_config'))
      payload.default_config = data.default_config;
    if (data.levels !== undefined && canEdit('levels')) payload.levels = data.levels;
    if (data.allocations !== undefined && canEdit('allocations')) {
      // feature_flag_id is immutable, but the flag is still needed to resolve allocation variations.
      const flagId = await this.resolveFlagId(data.feature_flag_name);
      payload.allocations = await this.buildAllocations(flagId, data.allocations);
    }
    if (data.status !== undefined && data.status !== 'draft' && data.status !== currentStatus) {
      payload.status = data.status;
    }
    return payload;
  }

  // --- export ------------------------------------------------------------------------------

  async getType(): Promise<Asset[]> {
    if (this.existing) return this.existing;

    const experiments: Asset[] = [];
    let page = await this.client.experimentation.experiments.list();
    experiments.push(...page.data);
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      experiments.push(...page.data);
    }

    // The API resolves feature_flag_name and allocation variation/segment names on read, so the
    // export just drops the tenant-specific ids and the copy-on-activate snapshots.
    this.existing = experiments.map((experiment) => {
      // Capture the current lifecycle state before stripping, so the update path can gate fields
      // on what the API still allows (editable_fields is stripped from the exported shape below).
      this.stateById[experiment.id] = {
        status: experiment.status,
        editableFields: Array.isArray(experiment.editable_fields) ? experiment.editable_fields : [],
      };
      const portable: Asset = { ...experiment };
      READ_ONLY_FIELDS.forEach((field) => delete portable[field]);
      if (Array.isArray(portable.allocations)) {
        portable.allocations = portable.allocations.map((allocation) => {
          const next = { ...allocation };
          delete next.variation_id;
          delete next.segment_id;
          delete next.variation_snapshot;
          delete next.segment_snapshot;
          return next;
        });
      }
      return portable;
    });
    return this.existing;
  }

  @order('82')
  async processChanges(assets: Assets): Promise<void> {
    const { experiments } = assets;
    if (!experiments) return;
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
