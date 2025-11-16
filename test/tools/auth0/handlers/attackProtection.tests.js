const { expect } = require('chai');
const attackProtection = require('../../../../src/tools/auth0/handlers/attackProtection');

describe('#attackProtection handler', () => {
  describe('#attackProtection process', () => {
    it('should fetch attack protection settings', async () => {
      const auth0 = {
        attackProtection: {
          getBotDetectionConfig: () => ({
            data: {
              bot_detection_level: 'medium',
              monitoring_mode_enabled: true,
              allowlist: ['10.0.0.0/24'],
            },
          }),
          getBreachedPasswordDetectionConfig: () => ({
            data: {
              admin_notification_frequency: [],
              enabled: true,
              method: 'standard',
              shields: [],
            }),
          },
          bruteForceProtection: {
            get: () => ({
              allowlist: [],
              enabled: true,
              max_attempts: 10,
              mode: 'count_per_identifier_and_ip',
              shields: ['block', 'user_notification'],
            },
          }),
          getCaptchaConfig: () => ({
            data: {
              selected: 'friendly_captcha',
              policy: 'always',
            },
          }),
          getSuspiciousIpThrottlingConfig: () => ({
            data: {
              allowlist: ['127.0.0.1'],
              enabled: true,
              shields: ['block', 'admin_notification'],
              stage: {
                'pre-login': {
                  max_attempts: 100,
                  rate: 864000,
                },
                'pre-user-registration': {
                  max_attempts: 50,
                  rate: 1200,
                },
              },
            }),
          },
        },
      };

      const handler = new attackProtection.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        botDetection: {
          bot_detection_level: 'medium',
          monitoring_mode_enabled: true,
          allowlist: ['10.0.0.0/24'],
        },
        breachedPasswordDetection: {
          admin_notification_frequency: [],
          enabled: true,
          method: 'standard',
          shields: [],
        },
        bruteForceProtection: {
          allowlist: [],
          enabled: true,
          max_attempts: 10,
          mode: 'count_per_identifier_and_ip',
          shields: ['block', 'user_notification'],
        },
        captcha: {
          selected: 'friendly_captcha',
          policy: 'always',
        },
        suspiciousIpThrottling: {
          allowlist: ['127.0.0.1'],
          enabled: true,
          shields: ['block', 'admin_notification'],
          stage: {
            'pre-login': {
              max_attempts: 100,
              rate: 864000,
            },
            'pre-user-registration': {
              max_attempts: 50,
              rate: 1200,
            },
          },
        },
      });
    });

    it('should update attack protection settings', async () => {
      const auth0 = {
        attackProtection: {
          updateBotDetectionConfig: (data) => {
            expect(data).to.be.an('object');
            expect(data).to.deep.equal({
              bot_detection_level: 'medium',
              monitoring_mode_enabled: false,
              allowlist: ['10.0.0.0/24'],
            });
            return Promise.resolve(data);
          },
          updateBreachedPasswordDetectionConfig: (data) => {
            expect(data).to.be.an('object');
            expect(data).to.deep.equal({
              admin_notification_frequency: [],
              enabled: true,
              method: 'standard',
              shields: [],
            });
            return Promise.resolve(data);
          },
          updateCaptchaConfig: (data) => {
            expect(data).to.be.an('object');
            expect(data).to.deep.equal({
              selected: 'friendly_captcha',
              policy: 'always',
            });
            return Promise.resolve(data);
          },
          updateSuspiciousIpThrottlingConfig: (data) => {
            expect(data).to.be.an('object');
            expect(data).to.deep.equal({
              allowlist: ['127.0.0.1'],
              enabled: true,
              shields: ['block', 'admin_notification'],
              stage: {
                'pre-login': {
                  max_attempts: 100,
                  rate: 864000,
                },
              });
              return Promise.resolve(data);
            },
          },
          bruteForceProtection: {
            update: (data) => {
              expect(data).to.be.an('object');
              expect(data).to.deep.equal({
                allowlist: [],
                enabled: true,
                max_attempts: 10,
                mode: 'count_per_identifier_and_ip',
                shields: ['block', 'user_notification'],
              });
              return Promise.resolve(data);
            },
          },
        },
      };

      const handler = new attackProtection.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          attackProtection: {
            botDetection: {
              bot_detection_level: 'medium',
              monitoring_mode_enabled: false,
              allowlist: ['10.0.0.0/24'],
            },
            breachedPasswordDetection: {
              admin_notification_frequency: [],
              enabled: true,
              method: 'standard',
              shields: [],
            },
            bruteForceProtection: {
              allowlist: [],
              enabled: true,
              max_attempts: 10,
              mode: 'count_per_identifier_and_ip',
              shields: ['block', 'user_notification'],
            },
            captcha: {
              selected: 'friendly_captcha',
              policy: 'always',
            },
            suspiciousIpThrottling: {
              allowlist: ['127.0.0.1'],
              enabled: true,
              shields: ['block', 'admin_notification'],
              stage: {
                'pre-login': {
                  max_attempts: 100,
                  rate: 864000,
                },
                'pre-user-registration': {
                  max_attempts: 50,
                  rate: 1200,
                },
              },
            },
          },
        },
      ]);
    });

    it('should handle 403 error when fetching bot detection and captcha configs', async () => {
      const auth0 = {
        attackProtection: {
          getBotDetectionConfig: () => {
            const err = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
          },
          getCaptchaConfig: () => {
            const err = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
          },
          getBreachedPasswordDetectionConfig: () => ({
            data: {
              admin_notification_frequency: [],
              enabled: true,
              method: 'standard',
              shields: [],
            },
          }),
          getBruteForceConfig: () => ({
            data: {
              allowlist: [],
              enabled: true,
              max_attempts: 10,
              mode: 'count_per_identifier_and_ip',
              shields: ['block', 'user_notification'],
            },
          }),
          getSuspiciousIpThrottlingConfig: () => ({
            data: {
              allowlist: ['127.0.0.1'],
              enabled: true,
              shields: ['block', 'admin_notification'],
              stage: {
                'pre-login': {
                  max_attempts: 100,
                  rate: 864000,
                },
                'pre-user-registration': {
                  max_attempts: 50,
                  rate: 1200,
                },
              },
            },
          }),
        },
      };

      const handler = new attackProtection.default({ client: auth0 });
      const data = await handler.getType();

      // Should return data without botDetection and captcha
      expect(data).to.deep.equal({
        breachedPasswordDetection: {
          admin_notification_frequency: [],
          enabled: true,
          method: 'standard',
          shields: [],
        },
        bruteForceProtection: {
          allowlist: [],
          enabled: true,
          max_attempts: 10,
          mode: 'count_per_identifier_and_ip',
          shields: ['block', 'user_notification'],
        },
        suspiciousIpThrottling: {
          allowlist: ['127.0.0.1'],
          enabled: true,
          shields: ['block', 'admin_notification'],
          stage: {
            'pre-login': {
              max_attempts: 100,
              rate: 864000,
            },
            'pre-user-registration': {
              max_attempts: 50,
              rate: 1200,
            },
          },
        },
      });
      expect(data).to.not.have.property('botDetection');
      expect(data).to.not.have.property('captcha');
    });

    it('should skip updates when attackProtection is null', async () => {
      const auth0 = {
        attackProtection: {},
      };

      const handler = new attackProtection.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          attackProtection: null,
        },
      ]);

      expect(handler.updated).to.equal(0);
    });

    it('should skip updates when attackProtection is empty object', async () => {
      const auth0 = {
        attackProtection: {},
      };

      const handler = new attackProtection.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          attackProtection: {},
        },
      ]);

      expect(handler.updated).to.equal(0);
    });

    it('should skip botDetection update when empty object', async () => {
      const auth0 = {
        attackProtection: {
          updateBreachedPasswordDetectionConfig: (data) => Promise.resolve(data),
          updateBruteForceConfig: (data) => Promise.resolve(data),
          updateSuspiciousIpThrottlingConfig: (data) => Promise.resolve(data),
        },
      };

      const handler = new attackProtection.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          attackProtection: {
            botDetection: {},
            breachedPasswordDetection: {
              enabled: true,
              shields: [],
              admin_notification_frequency: [],
              method: 'standard',
            },
            bruteForceProtection: {
              enabled: true,
              shields: ['block'],
              mode: 'count_per_identifier_and_ip',
              allowlist: [],
              max_attempts: 10,
            },
            suspiciousIpThrottling: {
              enabled: true,
              shields: ['block'],
              allowlist: [],
              stage: {},
            },
          },
        },
      ]);

      expect(handler.updated).to.equal(1);
    });

    it('should skip captcha update when empty object', async () => {
      const auth0 = {
        attackProtection: {
          updateBreachedPasswordDetectionConfig: (data) => Promise.resolve(data),
          updateBruteForceConfig: (data) => Promise.resolve(data),
          updateSuspiciousIpThrottlingConfig: (data) => Promise.resolve(data),
        },
      };

      const handler = new attackProtection.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          attackProtection: {
            captcha: {},
            breachedPasswordDetection: {
              enabled: true,
              shields: [],
              admin_notification_frequency: [],
              method: 'standard',
            },
            bruteForceProtection: {
              enabled: true,
              shields: ['block'],
              mode: 'count_per_identifier_and_ip',
              allowlist: [],
              max_attempts: 10,
            },
            suspiciousIpThrottling: {
              enabled: true,
              shields: ['block'],
              allowlist: [],
              stage: {},
            },
          },
        },
      ]);

      expect(handler.updated).to.equal(1);
    });

    it('should clean up empty captcha providers before update', async () => {
      let capturedCaptcha;
      const auth0 = {
        attackProtection: {
          updateCaptchaConfig: (data) => {
            capturedCaptcha = data;
            return Promise.resolve(data);
          },
          updateBreachedPasswordDetectionConfig: (data) => Promise.resolve(data),
          updateBruteForceConfig: (data) => Promise.resolve(data),
          updateSuspiciousIpThrottlingConfig: (data) => Promise.resolve(data),
        },
      };

      const handler = new attackProtection.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          attackProtection: {
            captcha: {
              active_provider_id: 'friendly_captcha',
              friendly_captcha: {
                site_key: 'my-key',
                secret: 'my-secret',
              },
              // Empty provider that should be removed
              recaptcha_v2: {
                site_key: '',
                secret: '',
              },
              // Empty auth_challenge provider
              auth_challenge: {},
              // Empty simple_captcha provider
              simple_captcha: {},
            },
            breachedPasswordDetection: {
              enabled: true,
            },
            bruteForceProtection: {
              enabled: true,
            },
            suspiciousIpThrottling: {
              enabled: true,
            },
          },
        },
      ]);

      expect(capturedCaptcha).to.not.have.property('recaptcha_v2');
      expect(capturedCaptcha).to.not.have.property('auth_challenge');
      expect(capturedCaptcha).to.not.have.property('simple_captcha');
      expect(capturedCaptcha).to.have.property('friendly_captcha');
      expect(handler.updated).to.equal(1);
    });

    it('should return cached existing data on subsequent calls', async () => {
      const auth0 = {
        attackProtection: {
          getBotDetectionConfig: () => ({
            data: {
              bot_detection_level: 'medium',
            },
          }),
          getCaptchaConfig: () => ({
            data: {
              active_provider_id: 'friendly_captcha',
            },
          }),
          getBreachedPasswordDetectionConfig: () => ({
            data: { enabled: true },
          }),
          getBruteForceConfig: () => ({
            data: { enabled: true },
          }),
          getSuspiciousIpThrottlingConfig: () => ({
            data: { enabled: true },
          }),
        },
      };

      const handler = new attackProtection.default({ client: auth0 });

      // First call
      const data1 = await handler.getType();

      // Second call should return cached data
      const data2 = await handler.getType();

      expect(data1).to.equal(data2);
    });
  });
});
