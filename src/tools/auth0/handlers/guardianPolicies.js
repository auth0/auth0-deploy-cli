import DefaultHandler from './default';
import constants from '../../constants';

export const schema = {
  type: 'object',
  properties: {
    policies: {
      type: 'array',
      items: {
        type: 'string',
        enum: constants.GUARDIAN_POLICIES
      }
    }
  },
  additionalProperties: false
};

export default class GuardianPoliciesHandler extends DefaultHandler {
  constructor(options) {
    super({
      ...options,
      type: 'guardianPolicies'
    });
  }

  async getType() {
    // in case client version does not support the operation
    if (!this.client.guardian || typeof this.client.guardian.getPolicies !== 'function') {
      return {};
    }

    if (this.existing) return this.existing;
    const policies = await this.client.guardian.getPolicies();
    this.existing = { policies };
    return this.existing;
  }

  async processChanges(assets) {
    // No API to delete or create guardianPolicies, we can only update.
    const { guardianPolicies } = assets;

    // Do nothing if not set
    if (!guardianPolicies || !guardianPolicies.policies) return;

    const params = {};
    const data = guardianPolicies.policies;
    await this.client.guardian.updatePolicies(params, data);
    this.updated += 1;
    this.didUpdate(guardianPolicies);
  }
}
