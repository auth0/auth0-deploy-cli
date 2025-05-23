import { Factor, FactorNameEnum } from 'auth0';
import DefaultHandler from './default';
import constants from '../../constants';
import { Asset, Assets } from '../../../types';
import { isForbiddenFeatureError } from '../../utils';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', enum: constants.GUARDIAN_FACTORS },
    },
    required: ['name'],
  },
};

export default class GuardianFactorsHandler extends DefaultHandler {
  existing: Asset[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'guardianFactors',
      id: 'name',
    });
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;
    try {
      const { data } = await this.client.guardian.getFactors();
      this.existing = data;
      return this.existing;
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
    // No API to delete or create guardianFactors, we can only update.
    const { guardianFactors } = assets;

    // Do nothing if not set
    if (!guardianFactors || !guardianFactors.length) return;

    // Process each factor
    await Promise.all(
      guardianFactors.map(async (factor: Factor) => {
        const data = { ...factor };
        const params = { name: factor.name as FactorNameEnum };
        delete data.name;
        await this.client.guardian.updateFactor(params, data);
        this.didUpdate(params);
        this.updated += 1;
      })
    );
  }
}
