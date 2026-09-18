import { Management } from 'auth0';
import DefaultHandler from './default';
import constants from '../../constants';
import { Assets } from '../../../types';
import { isDryRun, isInsufficientEntitlementError } from '../../utils';
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
    if (this.existing) return this.existing;
    const policies = await this.client.guardian.policies.list();
    this.existing = { policies };
    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    // No API to delete or create guardianPolicies, we can only update.
    const { guardianPolicies } = assets;

    // Do nothing if not set
    if (!guardianPolicies || !guardianPolicies.policies) return;

    if (isDryRun(this.config)) {
      const { del, update, create } = await this.calcChanges(assets);

      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }

    const data = guardianPolicies.policies as Management.SetGuardianPoliciesRequestContent;
    try {
      await this.client.guardian.policies.set(data);
    } catch (err) {
      if (isInsufficientEntitlementError(err)) {
        log.warn(
          'Skipping guardianPolicies deploy: tenant does not have Adaptive MFA entitlement (confidence-score requires an Enterprise add-on)'
        );
        return;
      }
      throw err;
    }
    this.updated += 1;
    this.didUpdate(guardianPolicies);
  }
}
