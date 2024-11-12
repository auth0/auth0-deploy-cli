import _ from 'lodash';
import { GetFlows200ResponseOneOfInner } from 'auth0';
import DefaultHandler, { order } from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';

export type Flow = {
  name: string;
  body: string;
};

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['name'],
  },
  additionalProperties: false,
};

export default class FlowHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'flows',
      id: 'id',
    });
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const flows = await paginate<GetFlows200ResponseOneOfInner>(this.client.flows.getAll, {
      paginate: true,
      include_totals: true,
    });

    const allFlows = await Promise.all(
      flows.map(async (f) => {
        const { data: flow } = await this.client.flows.get({ id: f.id });
        return flow;
      })
    );

    this.existing = allFlows;
    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { flows } = assets;

    // Do nothing if not set
    if (!flows) return;

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    const changes: CalculatedChanges = {
      del: del,
      update: update,
      create: create,
      conflicts: conflicts,
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }
}
