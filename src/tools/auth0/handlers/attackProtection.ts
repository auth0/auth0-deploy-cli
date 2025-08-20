import DefaultAPIHandler from './default';
import { Asset, Assets } from '../../../types';
import log from '../../../logger';
import { isDryRun } from '../../utils';

export const schema = {
  type: 'object',
  properties: {
    breachedPasswordDetection: {
      type: 'object',
    },
    bruteForceProtection: {
      type: 'object',
    },
    suspiciousIpThrottling: {
      type: 'object',
    },
  },
  additionalProperties: false,
};

export default class AttackProtectionHandler extends DefaultAPIHandler {
  existing: {
    breachedPasswordDetection: any;
    bruteForceProtection: any;
    suspiciousIpThrottling: any;
  } | null;

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'attackProtection',
    });
  }

  objString(item: Asset): string {
    const objectString = (() => {
      const obj = {};
      if (item.breachedPasswordDetection?.enabled) {
        obj['breached-password-protection'] = {
          enabled: item.breachedPasswordDetection.enabled,
        };
      }
      if (item.bruteForceProtection?.enabled) {
        obj['brute-force-protection'] = {
          enabled: item.bruteForceProtection.enabled,
        };
      }
      if (item.suspiciousIpThrottling?.enabled) {
        obj['suspicious-ip-throttling'] = {
          enabled: item.suspiciousIpThrottling.enabled,
        };
      }
      return obj;
    })();

    return super.objString(objectString);
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const [breachedPasswordDetection, bruteForceProtection, suspiciousIpThrottling] =
      await Promise.all([
        this.client.attackProtection.getBreachedPasswordDetectionConfig(),
        this.client.attackProtection.getBruteForceConfig(),
        this.client.attackProtection.getSuspiciousIpThrottlingConfig(),
      ]);

    this.existing = {
      breachedPasswordDetection: breachedPasswordDetection.data,
      bruteForceProtection: bruteForceProtection.data,
      suspiciousIpThrottling: suspiciousIpThrottling.data,
    };

    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { attackProtection } = assets;

    if (!attackProtection || !Object.keys(attackProtection).length) {
      return;
    }

    if (isDryRun(this.config)) {
      const { del, update, create } = await this.calcChanges(assets);

      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }

    await Promise.all([
      this.client.attackProtection.updateBreachedPasswordDetectionConfig(
        attackProtection.breachedPasswordDetection
      ),
      this.client.attackProtection.updateSuspiciousIpThrottlingConfig(
        attackProtection.suspiciousIpThrottling
      ),
      this.client.attackProtection.updateBruteForceConfig(attackProtection.bruteForceProtection),
    ]);

    this.updated += 1;
    this.didUpdate(attackProtection);
  }
}
