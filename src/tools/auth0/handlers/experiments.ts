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

// On disk an experiment references its parent flag, variations and segments by portable name
// rather than the tenant-specific ids, and the copy-on-activate snapshots are dropped. This is
// the shape written to and read from config, not the raw API response.
export type PortableAllocation = {
  variation_name: string;
  segment_name?: string;
  is_control: boolean;
  weight?: number;
  priority?: number;
  is_fallback?: boolean;
};

export type Experiment = Omit<
  Management.GetExperimentResponseContent,
  'feature_flag_id' | 'feature_flag_snapshot' | 'allocations'
> & {
  feature_flag_name: string;
  allocations?: PortableAllocation[];
};

// Read-only / tenant-specific / API-generated fields removed from the exported config.
// created_at/updated_at are stripped for the same reason as the sibling handlers: they churn
// users' config on every export and show up as phantom diffs in dry-run.
const READ_ONLY_FIELDS = [
  'feature_flag_id',
  'feature_flag_snapshot',
  'is_valid',
  'editable_fields',
  'current_level',
  'started_at',
  'ended_at',
  'created_at',
  'updated_at',
];

export default class ExperimentsHandler extends DefaultAPIHandler {
  existing: Asset[] | null;

  private flagNameToId: { [name: string]: string } = {};

  private segmentNameToId: { [name: string]: string } = {};

  private variationNameToIdByFlag: { [flagId: string]: { [name: string]: string } } = {};

  // Current server state per existing experiment, captured in getType. Used by the update path to
  // only send fields the API still allows at the experiment's current lifecycle status
  // (editable_fields is the API's own response-time computation of what is mutable) and to warn
  // when the config diverges from what the API will accept. editableFields is null when the
  // response did not carry it, meaning "no restriction known" rather than "nothing editable".
  private stateById: {
    [id: string]: { status: string; editableFields: string[] | null; existing: Asset };
  } = {};

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

  // Config fields that are dropped for a frozen (non-draft) experiment. Used only to warn.
  private static readonly FROZEN_CONFIG_FIELDS = [
    'name',
    'description',
    'default_config',
    'levels',
    'allocations',
  ];

  private async toUpdatePayload(id: string, data: Asset): Promise<Asset> {
    // `id` comes from the handler's update function (the base strips it from `data`).
    const state = this.stateById[id];
    const currentStatus = state?.status;
    const existing = state?.existing;

    // Once an experiment is activated its configuration snapshot is frozen: the API rejects any
    // field edit with experiment_snapshot_frozen ("clone it to make changes") and rejects an
    // empty body, so the only accepted update is a status value. Send status alone, which also
    // performs lifecycle transitions (e.g. active -> paused) and is an accepted no-op when the
    // status is unchanged. Config and allocation edits to an activated experiment are not
    // possible through this API (it requires cloning) and so are intentionally not sent.
    if (currentStatus && currentStatus !== 'draft') {
      // Those dropped edits are otherwise invisible (the run still logs "Updated"), so warn when
      // the config actually diverges from the frozen experiment.
      if (
        existing &&
        ExperimentsHandler.FROZEN_CONFIG_FIELDS.some(
          (field) => data[field] !== undefined && !isEqual(data[field], existing[field])
        )
      ) {
        log.warn(
          `Experiment "${data.name}" is frozen in status "${currentStatus}"; configuration changes (allocations, levels, default_config, name, description) are ignored. Clone it to make changes.`
        );
      }
      const target = data.status && data.status !== 'draft' ? data.status : currentStatus;
      return { status: target };
    }

    // allocation_strategy is create-only (it is on CreateExperimentRequestContent but not the
    // update parameters), so a change to it on an existing draft cannot be applied. Warn rather
    // than silently sending allocations that no longer match the stored strategy.
    if (
      existing &&
      data.allocation_strategy !== undefined &&
      data.allocation_strategy !== existing.allocation_strategy
    ) {
      log.warn(
        `Experiment "${data.name}" allocation_strategy is create-only and cannot be changed from "${existing.allocation_strategy}" to "${data.allocation_strategy}" on an existing experiment; the change is ignored. Recreate the experiment to change it.`
      );
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

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;

    try {
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
        // The portable export carries only names (the ids are dropped above). If the list response
        // did not resolve a name, the exported experiment could not be re-imported, so fail loudly
        // here rather than writing a silently broken config.
        this.assertPortable(experiment, portable);
        // Capture the pre-strip state so the update path can gate edits on what the API allows and
        // warn when the config diverges. editableFields is null (not []) when absent, so the
        // update path treats a missing list as "no restriction" instead of "nothing editable".
        this.stateById[experiment.id] = {
          status: experiment.status,
          editableFields: Array.isArray(experiment.editable_fields)
            ? experiment.editable_fields
            : null,
          existing: portable,
        };
        return portable;
      });
      return this.existing;
    } catch (err) {
      // Experiment Center is entitlement-gated. On a tenant without the entitlement the endpoints
      // answer 403/404 (or 501 where unimplemented); treat that as "no experiments to manage" and
      // skip the resource rather than failing the whole export/import.
      if (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 501) {
        log.debug('Experiment Center is not enabled for this tenant; skipping experiments.');
        return null;
      }
      throw err;
    }
  }

  // Guards that the list response resolved the names the portable export depends on. A missing
  // feature_flag_name or allocation variation_name would export an experiment that cannot be
  // re-imported (the ids are dropped and the schema requires the names), so surface it clearly.
  private assertPortable(experiment: Asset, portable: Asset): void {
    if (!portable.feature_flag_name) {
      throw new Error(
        `Experiment "${experiment.name}" was returned without feature_flag_name; cannot produce a portable export. This usually means the tenant is missing the Experiment Center entitlement or the API did not resolve the name.`
      );
    }
    (portable.allocations || []).forEach((allocation) => {
      if (!allocation.variation_name) {
        throw new Error(
          `Experiment "${experiment.name}" has an allocation without variation_name; cannot produce a portable export.`
        );
      }
    });
  }

  @order('82')
  async processChanges(assets: Assets): Promise<void> {
    const { experiments } = assets;
    if (!experiments) return;
    await super.processChanges(assets, await this.calcChanges(assets));
  }
}
