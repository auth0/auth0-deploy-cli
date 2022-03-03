import DefaultHandler from './default';

export const schema = {
  type: 'object'
};

export default class AttackProtectionHandler extends DefaultHandler {
  constructor(config) {
    super({
      ...config,
      type: 'attackProtection'
    });
  }

  objString(item) {
    return super.objString({
      'breached-password-protection': {
        enabled: item.breachedPasswordDetection.enabled
      },
      'brute-force-protection': {
        enabled: item.bruteForceProtection.enabled
      },
      'suspicious-ip-throttling': {
        enabled: item.suspiciousIpThrottling.enabled
      }
    });
  }

  async getType() {
    if (this.existing) {
      return this.existing;
    }

    const breachedPasswordDetection = await this.client.attackProtection.getBreachedPasswordDetectionConfig();
    const bruteForceProtection = await this.client.attackProtection.getBruteForceConfig();
    const suspiciousIpThrottling = await this.client.attackProtection.getSuspiciousIpThrottlingConfig();

    this.existing = {
      breachedPasswordDetection: breachedPasswordDetection,
      bruteForceProtection: bruteForceProtection,
      suspiciousIpThrottling: suspiciousIpThrottling
    };

    return this.existing;
  }

  async processChanges(assets) {
    const { attackProtection } = assets;

    if (!attackProtection || !Object.keys(attackProtection).length) {
      return;
    }

    await this.client.attackProtection
      .updateBreachedPasswordDetectionConfig({}, attackProtection.breachedPasswordDetection);

    await this.client.attackProtection
      .updateSuspiciousIpThrottlingConfig({}, attackProtection.suspiciousIpThrottling);

    await this.client.attackProtection
      .updateBruteForceConfig({}, attackProtection.bruteForceProtection);

    this.updated += 1;
    this.didUpdate(attackProtection);
  }
}
