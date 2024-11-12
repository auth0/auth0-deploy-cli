import _ from 'lodash';
import { GetForms200ResponseOneOfInner, PostForms201Response } from 'auth0';
import DefaultHandler from './default';
import constants from '../../constants';
import log from '../../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';

export type Form = {
  name: string;
  body: string;
};

export type FormResponse = PostForms201Response;

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

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const forms = await paginate<GetForms200ResponseOneOfInner>(this.client.forms.getAll, {
      paginate: true,
      include_totals: true,
    });

    const allForms = await Promise.all(
      forms.map(async (from) => {
        const { data: form } = await this.client.forms.get({ id: from.id });
        return form;
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
