import { Management } from 'auth0';
import DefaultHandler from './default';
import constants from '../../constants';
import { Assets, Asset } from '../../../types';
import { isForbiddenFeatureError } from '../../utils';

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

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;
    try {
      const data = await Promise.all(
        constants.GUARDIAN_FACTOR_TEMPLATES.map(async (name) => {
          if (name === 'sms') {
            const templates = await this.client.guardian.factors.sms.getTemplates();
            return { name, ...templates };
          }

          const templates = await this.client.guardian.factors.phone.getTemplates();
          return { name, ...templates };
        })
      );

      // Filter out empty, should have more then 1 keys (name)
      return data.filter((d) => Object.keys(d).length > 1);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }
      if (isForbiddenFeatureError(err, this.type)) {
        return null;
      }

      throw err;
    }
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
          await this.client.guardian.factors.sms.setTemplates(
            data as Management.SetGuardianFactorSmsTemplatesRequestContent
          );
        } else if (name === 'phone') {
          await this.client.guardian.factors.phone.setTemplates(
            data as Management.SetGuardianFactorPhoneTemplatesRequestContent
          );
        }
        this.didUpdate(params);
        this.updated += 1;
      })
    );
  }
}
