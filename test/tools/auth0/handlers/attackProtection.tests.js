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
                'pre-user-registration': {
                  max_attempts: 50,
                  rate: 1200,
                },
              },
            });
            return Promise.resolve(data);
          },
          updateBruteForceConfig: (data) => {
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

      const handler = new attackProtection.default({ client: auth0, config: () => ({}) });
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

  describe('#attackProtection dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return update changes for attackProtection with differences', async () => {
      const auth0 = {
        attackProtection: {
          getBreachedPasswordDetectionConfig: () => ({
            data: {
              admin_notification_frequency: [],
              enabled: false,
              method: 'standard',
              shields: [],
            },
          }),
          getBruteForceConfig: () => ({
            data: {
              allowlist: [],
              enabled: true,
              max_attempts: 5,
              mode: 'count_per_identifier_and_ip',
              shields: ['block'],
            },
          }),
          getSuspiciousIpThrottlingConfig: () => ({
            data: {
              allowlist: ['127.0.0.1'],
              enabled: true,
              shields: ['block'],
              stage: {
                'pre-login': {
                  max_attempts: 50,
                  rate: 432000,
                },
              },
            },
          }),
        },
      };

      const handler = new attackProtection.default({ client: auth0, config: dryRunConfig });
      const assets = {
        attackProtection: {
          breachedPasswordDetection: {
            enabled: true,
            method: 'enhanced',
            shields: ['admin_notification'],
          },
          bruteForceProtection: {
            enabled: true,
            max_attempts: 10,
            mode: 'count_per_identifier_and_ip',
            shields: ['block', 'user_notification'],
          },
          suspiciousIpThrottling: {
            allowlist: ['192.168.1.1'],
            enabled: true,
            shields: ['block', 'admin_notification'],
            stage: {
              'pre-login': {
                max_attempts: 100,
                rate: 864000,
              },
            },
          },
        },
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when attackProtection is identical', async () => {
      const auth0 = {
        attackProtection: {
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
              },
            },
          }),
        },
      };

      const handler = new attackProtection.default({ client: auth0, config: dryRunConfig });
      const assets = {
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
            },
          },
        },
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const auth0 = {
        attackProtection: {
          getBreachedPasswordDetectionConfig: () => ({
            data: {
              enabled: true,
              method: 'standard',
            },
          }),
          getBruteForceConfig: () => ({
            data: {
              enabled: true,
              max_attempts: 10,
            },
          }),
          getSuspiciousIpThrottlingConfig: () => ({
            data: {
              enabled: true,
              shields: ['block'],
            },
          }),
        },
      };

      const handler = new attackProtection.default({ client: auth0, config: dryRunConfig });
      const assets = {}; // No attackProtection property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
