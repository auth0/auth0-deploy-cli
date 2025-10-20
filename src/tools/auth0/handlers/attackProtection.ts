import DefaultAPIHandler from './default';
import { Asset, Assets } from '../../../types';

export const schema = {
  type: 'object',
  properties: {
    botDetection: {
      type: 'object',
      properties: {
        bot_detection_level: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'The level of bot detection sensitivity',
        },
        challenge_password_policy: {
          type: 'string',
          enum: ['never', 'when_risky', 'always'],
          description: 'The policy that defines how often to show CAPTCHA for password flows',
        },
        challenge_passwordless_policy: {
          type: 'string',
          enum: ['never', 'when_risky', 'always'],
          description: 'The policy that defines how often to show CAPTCHA for passwordless flows',
        },
        challenge_password_reset_policy: {
          type: 'string',
          enum: ['never', 'when_risky', 'always'],
          description: 'The policy that defines how often to show CAPTCHA for password reset flows',
        },
        allowlist: {
          type: 'array',
          items: {
            type: 'string',
            oneOf: [
              {
                type: 'string',
                format: 'ipv4',
                description: 'IPv4 address or CIDR block',
              },
              {
                type: 'string',
                format: 'ipv6',
                description: 'IPv6 address or CIDR block',
              },
            ],
            description: 'IP address (IPv4 or IPv6) or CIDR block',
          },
          description: 'List of IP addresses or CIDR blocks to allowlist',
        },
        monitoring_mode_enabled: {
          type: 'boolean',
          description: 'Whether monitoring mode is enabled (logs but does not block)',
        },
      },
    },
    breachedPasswordDetection: {
      type: 'object',
    },
    bruteForceProtection: {
      type: 'object',
    },
    captcha: {
      type: 'object',
      properties: {
        active_provider_id: {
          type: 'string',
          description: 'The id of the active provider for the CAPTCHA.',
          enum: [
            'arkose',
            'auth_challenge',
            'friendly_captcha',
            'hcaptcha',
            'recaptcha_v2',
            'recaptcha_enterprise',
            'simple_captcha',
          ],
        },
        arkose: {
          type: 'object',
          properties: {
            site_key: {
              type: 'string',
              description: 'The site key for the Arkose captcha provider.',
            },
            secret: {
              type: 'string',
              description: 'The secret key for the Arkose captcha provider.',
            },
            client_subdomain: {
              type: 'string',
              description: 'The subdomain used for client requests to the Arkose captcha provider.',
            },
            verify_subdomain: {
              type: 'string',
              description:
                'The subdomain used for server-side verification requests to the Arkose captcha provider.',
            },
            fail_open: {
              type: 'boolean',
              description: 'Whether the captcha should fail open.',
            },
          },
          required: ['site_key', 'secret'],
          additionalProperties: false,
        },
        auth_challenge: {
          type: 'object',
          properties: {
            fail_open: {
              type: 'boolean',
              description: 'Whether the auth challenge should fail open.',
            },
          },
          required: ['fail_open'],
          additionalProperties: false,
        },
        hcaptcha: {
          type: 'object',
          properties: {
            site_key: {
              type: 'string',
              description: 'The site key for the hCaptcha provider.',
            },
            secret: {
              type: 'string',
              description: 'The secret key for the hCaptcha provider.',
            },
          },
          required: ['site_key', 'secret'],
          additionalProperties: false,
        },
        friendly_captcha: {
          type: 'object',
          properties: {
            site_key: {
              type: 'string',
              description: 'The site key for the Friendly Captcha provider.',
            },
            secret: {
              type: 'string',
              description: 'The secret key for the Friendly Captcha provider.',
            },
          },
          required: ['site_key', 'secret'],
          additionalProperties: false,
        },
        recaptcha_enterprise: {
          type: 'object',
          properties: {
            site_key: {
              type: 'string',
              description: 'The site key for the reCAPTCHA Enterprise provider.',
            },
            api_key: {
              type: 'string',
              description: 'The API key for the reCAPTCHA Enterprise provider.',
            },
            project_id: {
              type: 'string',
              description: 'The project ID for the reCAPTCHA Enterprise provider.',
            },
          },
          required: ['site_key', 'api_key', 'project_id'],
          additionalProperties: false,
        },
        recaptcha_v2: {
          type: 'object',
          properties: {
            site_key: {
              type: 'string',
              description: 'The site key for the reCAPTCHA v2 provider.',
            },
            secret: {
              type: 'string',
              description: 'The secret key for the reCAPTCHA v2 provider.',
            },
          },
          required: ['site_key', 'secret'],
          additionalProperties: false,
        },
        simple_captcha: {
          type: 'object',
        },
      },
    },
    suspiciousIpThrottling: {
      type: 'object',
    },
  },
  additionalProperties: false,
};

export default class AttackProtectionHandler extends DefaultAPIHandler {
  existing: {
    botDetection?: any;
    breachedPasswordDetection: any;
    bruteForceProtection: any;
    captcha?: any;
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
      const obj: Record<string, unknown> = {};
      if (item.botDetection) {
        obj['bot-detection'] = {
          bot_detection_level: item.botDetection.bot_detection_level,
          monitoring_mode_enabled: item.botDetection.monitoring_mode_enabled,
        };
      }
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
      if (item.captcha) {
        obj.captcha = {
          selected: item.captcha.selected,
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

    const attackProtectionClient = this.client.attackProtection as Record<string, any>;
    const botDetectionPromise =
      typeof attackProtectionClient.getBotDetectionConfig === 'function'
        ? attackProtectionClient.getBotDetectionConfig()
        : Promise.resolve({ data: null });
    const captchaPromise =
      typeof attackProtectionClient.getCaptchaConfig === 'function'
        ? attackProtectionClient.getCaptchaConfig()
        : Promise.resolve({ data: null });

    const [
      botDetection,
      captcha,
      breachedPasswordDetection,
      bruteForceProtection,
      suspiciousIpThrottling,
    ] = await Promise.all([
      botDetectionPromise,
      captchaPromise,
      attackProtectionClient.getBreachedPasswordDetectionConfig(),
      attackProtectionClient.getBruteForceConfig(),
      attackProtectionClient.getSuspiciousIpThrottlingConfig(),
    ]);

    this.existing = {
      botDetection: botDetection?.data ?? null,
      breachedPasswordDetection: breachedPasswordDetection.data,
      bruteForceProtection: bruteForceProtection.data,
      captcha: captcha?.data ?? null,
      suspiciousIpThrottling: suspiciousIpThrottling.data,
    };

    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { attackProtection } = assets;

    if (!attackProtection || !Object.keys(attackProtection).length) {
      return;
    }

    const updates: Promise<unknown>[] = [];

    const attackProtectionClient = this.client.attackProtection as Record<string, any>;

    if (attackProtection.botDetection && Object.keys(attackProtection.botDetection).length) {
      if (typeof attackProtectionClient.updateBotDetectionConfig === 'function') {
        updates.push(
          attackProtectionClient.updateBotDetectionConfig.call(
            attackProtectionClient,
            attackProtection.botDetection
          )
        );
      }
    }

    if (attackProtection.breachedPasswordDetection) {
      updates.push(
        attackProtectionClient.updateBreachedPasswordDetectionConfig(
          attackProtection.breachedPasswordDetection
        )
      );
    }

    if (attackProtection.captcha && Object.keys(attackProtection.captcha).length) {
      if (typeof attackProtectionClient.updateCaptchaConfig === 'function') {
        updates.push(
          attackProtectionClient.updateCaptchaConfig.call(
            attackProtectionClient,
            attackProtection.captcha
          )
        );
      }
    }

    if (attackProtection.bruteForceProtection) {
      updates.push(
        attackProtectionClient.updateBruteForceConfig(attackProtection.bruteForceProtection)
      );
    }

    if (attackProtection.suspiciousIpThrottling) {
      updates.push(
        attackProtectionClient.updateSuspiciousIpThrottlingConfig(
          attackProtection.suspiciousIpThrottling
        )
      );
    }

    if (!updates.length) {
      return;
    }

    await Promise.all(updates);

    this.updated += 1;
    this.didUpdate(attackProtection);
  }
}
