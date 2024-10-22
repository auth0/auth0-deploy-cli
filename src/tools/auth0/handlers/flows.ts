import _ from 'lodash';
import DefaultHandler, { order } from './default';
import constants from '../../constants';
import log from '../../../logger';
import { Asset, Assets } from '../../../types';

export type Flow = {
  name: string;
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
    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {}
}
