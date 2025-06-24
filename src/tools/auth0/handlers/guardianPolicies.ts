import DefaultHandler from './default';
import constants from '../../constants';
import { Assets } from '../../../types';
import log from '../../../logger';

export const schema = {
  type: 'object',
  properties: {
    policies: {
      type: 'array',
      items: {
        type: 'string',
        enum: constants.GUARDIAN_POLICIES,
      },
    },
  },
  additionalProperties: false,
};

export default class GuardianPoliciesHandler extends DefaultHandler {
  existing: {
    policies: string[];
  };

  constructor(options) {
    super({
      ...options,
      type: 'guardianPolicies',
    });
  }

  // TODO: standardize empty object literal with more intentional empty indicator
  async getType(): Promise<GuardianPoliciesHandler['existing'] | {}> {
    // in case client version does not support the operation
    if (!this.client.guardian || typeof this.client.guardian.getPolicies !== 'function') {
      return {};
    }

    if (this.existing) return this.existing;
    const { data: policies } = await this.client.guardian.getPolicies();
    this.existing = { policies };
    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    // No API to delete or create guardianPolicies, we can only update.
    const { guardianPolicies } = assets;

    // Do nothing if not set
    if (!guardianPolicies || !guardianPolicies.policies) return;

    const { del, update, create } = await this.calcChanges(assets);

    log.debug(
      `Start processChanges for guardianPolicies [delete:${del.length}] [update:${update.length}], [create:${create.length}]`
    );

    if (update.length === 0) {
      return;
    }
    const data = guardianPolicies.policies;
    await this.client.guardian.updatePolicies(data);
    this.updated += 1;
    this.didUpdate(guardianPolicies);
  }
}
