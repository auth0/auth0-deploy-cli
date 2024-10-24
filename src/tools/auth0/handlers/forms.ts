import _ from 'lodash';
import DefaultHandler from './default';
import constants from '../../constants';
import log from '../../../logger';
import { Asset, Assets } from '../../../types';
import { paginate } from '../client';

export type Form = {
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

export default class FormsHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'forms',
      id: 'id',
    });
  }

  async getType(): Promise<DefaultHandler['existing']> {
    if (this.existing) {
      return this.existing;
    }

    // TODO: Implement pagination
    const { data: forms } = await this.client.forms.getForms();

    const allForms = await Promise.all(
      forms.map(async (f) => {
        try {
          const { data: form } = await this.client.forms.getFormsById({ id: f.id });
          return form;
        } catch (err) {
          // Ignore if not found, else throw error
          if (err.statusCode !== 404) {
            throw err;
          }
        }
      })
    );
    this.existing = allForms;
    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { forms } = assets;

    // Do nothing if not set
    if (!forms) return;

    const { del, update, create, conflicts } = await this.calcChanges(assets);
    console.log('Forms processChanges', del, update, create, conflicts);
  }
}
