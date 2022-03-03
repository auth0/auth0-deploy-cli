import DefaultHandler from './default';

export const schema = {
  type: 'object',
  properties: {
    breachedPasswordDetection: {
      type: 'object'
    },
    bruteForceProtection: {
      type: 'object'
    },
    suspiciousIpThrottling: {
      type: 'object'
    }
  },
  additionalProperties: false
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

    const [ breachedPasswordDetection, bruteForceProtection, suspiciousIpThrottling ] = await Promise.all([
      this.client.attackProtection.getBreachedPasswordDetectionConfig(),
      this.client.attackProtection.getBruteForceConfig(),
      this.client.attackProtection.getSuspiciousIpThrottlingConfig()
    ]);

    this.existing = {
      breachedPasswordDetection,
      bruteForceProtection,
      suspiciousIpThrottling
    };

    return this.existing;
  }

  async processChanges(assets) {
    const { attackProtection } = assets;

    if (!attackProtection || !Object.keys(attackProtection).length) {
      return;
    }

    Promise.all([
      this.client.attackProtection
        .updateBreachedPasswordDetectionConfig({}, attackProtection.breachedPasswordDetection),
      this.client.attackProtection
        .updateSuspiciousIpThrottlingConfig({}, attackProtection.suspiciousIpThrottling),
      this.client.attackProtection
        .updateBruteForceConfig({}, attackProtection.bruteForceProtection)
    ]);

    this.updated += 1;
    this.didUpdate(attackProtection);
  }
}
