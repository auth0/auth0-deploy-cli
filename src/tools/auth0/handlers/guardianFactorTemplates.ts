import DefaultHandler from './default';
import constants from '../../constants';
import { Assets, Asset } from '../../../types';
import { TemplateMessages } from 'auth0';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', enum: constants.GUARDIAN_FACTOR_TEMPLATES },
    },
    required: ['name'],
  },
};

export default class GuardianFactorTemplatesHandler extends DefaultHandler {
  existing: Asset[];

  constructor(options) {
    super({
      ...options,
      type: 'guardianFactorTemplates',
      id: 'name',
    });
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) return this.existing;

    const data = await Promise.all(
      constants.GUARDIAN_FACTOR_TEMPLATES.map(async (name) => {
        // TODO: This is quite a change, needs to be validated for sure.
        if (name === 'sms') {
          const { data: templates } = await this.client.guardian.getSmsFactorTemplates();
          return { name, ...templates };
          // TODO: GUARDIAN_FACTOR_TEMPLATES only contains 'sms'. Is that expected? We also have 'phone'.
        } else {
          const { data: templates } = await this.client.guardian.getPhoneFactorTemplates();
          return { name, ...templates };
        }
      })
    );

    // Filter out empty, should have more then 1 keys (name)
    return data.filter((d) => Object.keys(d).length > 1);
  }

  async processChanges(assets: Assets): Promise<void> {
    // No API to delete or create guardianFactorTemplates, we can only update.
    const { guardianFactorTemplates } = assets;

    // Do nothing if not set
    if (!guardianFactorTemplates || !guardianFactorTemplates.length) return;

    // Process each factor templates
    await Promise.all(
      guardianFactorTemplates.map(async (fatorTemplates) => {
        const { name, ...data } = fatorTemplates;
        const params = { name: fatorTemplates.name };
        // TODO: This is quite a change, needs to be validated for sure.
        if (name === 'sms') {
          await this.client.guardian.setSmsFactorTemplates(data as TemplateMessages);
        } else if (name ==='phone') {
          await this.client.guardian.setPhoneFactorTemplates(data as TemplateMessages);
        }
        this.didUpdate(params);
        this.updated += 1;
      })
    );
  }
}
