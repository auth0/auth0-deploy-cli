const { expect } = require('chai');
const attackProtection = require('../../../../src/tools/auth0/handlers/attackProtection');

describe('#attackProtection handler', () => {
  describe('#attackProtection process', () => {
    it('should fetch attack protection settings', async () => {
      const auth0 = {
        attackProtection: {
          getBreachedPasswordDetectionConfig: () => ({
            data: {
              admin_notification_frequency: [],
              enabled: true,
              method: 'standard',
              shields: [],
            }
          }),
          getBruteForceConfig: () => ({
            data: {
              allowlist: [],
              enabled: true,
              max_attempts: 10,
              mode: 'count_per_identifier_and_ip',
              shields: ['block', 'user_notification'],
            }
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
              }
            },
          }),
        },
      };

      const handler = new attackProtection.default({ client: auth0 });
      const data = await handler.getType();
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
    });

    it('should update attack protection settings', async () => {
      const auth0 = {
        attackProtection: {
          updateBreachedPasswordDetectionConfig: (params, data) => {
            expect(data).to.be.an('object');
            expect(data).to.deep.equal({
              admin_notification_frequency: [],
              enabled: true,
              method: 'standard',
              shields: [],
            });
            return Promise.resolve(data);
          },
          updateSuspiciousIpThrottlingConfig: (params, data) => {
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
                'pre-user-registration': {
                  max_attempts: 50,
                  rate: 1200,
                },
              },
            });
            return Promise.resolve(data);
          },
          updateBruteForceConfig: (params, data) => {
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
      };

      const handler = new attackProtection.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          attackProtection: {
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
          },
        },
      ]);
    });
  });
});
