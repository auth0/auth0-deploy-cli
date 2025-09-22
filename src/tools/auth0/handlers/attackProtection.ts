import DefaultAPIHandler from './default';
import { Asset, Assets } from '../../../types';

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
        this.client.attackProtection.breachedPasswordDetection.get(),
        this.client.attackProtection.bruteForceProtection.get(),
        this.client.attackProtection.suspiciousIpThrottling.get(),
      ]);

    this.existing = {
      breachedPasswordDetection: breachedPasswordDetection,
      bruteForceProtection: bruteForceProtection,
      suspiciousIpThrottling: suspiciousIpThrottling,
    };

    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { attackProtection } = assets;

    if (!attackProtection || !Object.keys(attackProtection).length) {
      return;
    }

    await Promise.all([
      this.client.attackProtection.breachedPasswordDetection.update(
        attackProtection.breachedPasswordDetection
      ),
      this.client.attackProtection.suspiciousIpThrottling.update(
        attackProtection.suspiciousIpThrottling
      ),
      this.client.attackProtection.bruteForceProtection.update(
        attackProtection.bruteForceProtection
      ),
    ]);

    this.updated += 1;
    this.didUpdate(attackProtection);
  }
}
