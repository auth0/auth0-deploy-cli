import _ from 'lodash';
import DefaultHandler, { order } from './default';
import constants from '../../constants';
import log from '../../../logger';
import { Asset, Assets } from '../../../types';

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
      body: { type: 'string', default: '' },
    },
    required: ['name', 'body'],
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

  async getType(): Promise<DefaultHandler['existing']> {
    if (this.existing) {
      return this.existing;
    }
    // TODO: Implement pagination
    const { data: flows } = await this.client.flows.getFlows();

    const allFlows = await Promise.all(
      flows.map(async (f) => {
        try {
          const { data: flow } = await this.client.flows.getFlowsById({ id: f.id });
          return flow;
        } catch (err) {
          // Ignore if not found, else throw error
          if (err.statusCode !== 404) {
            throw err;
          }
        }
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
    console.log('Flows processChanges', del, update, create, conflicts);
  }
}
