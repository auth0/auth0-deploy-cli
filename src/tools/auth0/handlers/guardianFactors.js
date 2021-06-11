import DefaultHandler from './default';
import constants from '../../constants';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', enum: constants.GUARDIAN_FACTORS }
    },
    required: [ 'name' ]
  }
};

export default class GuardianFactorsHandler extends DefaultHandler {
  constructor(options) {
    super({
      ...options,
      type: 'guardianFactors',
      id: 'name'
    });
  }

  async getType() {
    if (this.existing) return this.existing;
    this.existing = await this.client.guardian.getFactors();
    return this.existing;
  }

  async processChanges(assets) {
    // No API to delete or create guardianFactors, we can only update.
    const { guardianFactors } = assets;

    // Do nothing if not set
    if (!guardianFactors || !guardianFactors.length) return;

    // Process each factor
    await Promise.all(guardianFactors.map(async (factor) => {
      const data = { ...factor };
      const params = { name: factor.name };
      delete data.name;
      await this.client.guardian.updateFactor(params, data);
      this.didUpdate(params);
      this.updated += 1;
    }));
  }
}
