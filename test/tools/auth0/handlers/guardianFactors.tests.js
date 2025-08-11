import { sortGuardianFactors } from '../../../../src/tools/utils';

const { expect } = require('chai');
const guardianFactorsTests = require('../../../../src/tools/auth0/handlers/guardianFactors');
const {
  default: GuardianFactorsHandler,
} = require('../../../../src/tools/auth0/handlers/guardianFactors');

function stub() {
  const s = function (...args) {
    s.callCount += 1;
    s.calls.push(args);
    s.called = true;
    return s.returnValue;
  };

  s.called = false;
  s.callCount = 0;
  s.calls = [];
  s.returnValue = undefined;
  s.returns = (r) => {
    s.returnValue = r;
    return s;
  };

  return s;
}

function mockFactorSms(overrides = {}) {
  return {
    name: 'sms',
    enabled: false,
    ...overrides,
  };
}

function mockFactorDuo(overrides = {}) {
  return {
    name: 'duo',
    enabled: false,
    ...overrides,
  };
}

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#guardianFactors handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#guardianFactors validate', () => {
    it('should not allow same names', async () => {
      const handler = new guardianFactorsTests.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'sms',
        },
        {
          name: 'sms',
        },
      ];

      try {
        await stageFn.apply(handler, [{ guardianFactors: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new guardianFactorsTests.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'sms',
        },
      ];

      await stageFn.apply(handler, [{ guardianFactors: data }]);
    });
  });

  describe('#guardianFactors process', () => {
    it('should handle forbidden error', async () => {
      const auth0 = {
        guardian: {
          getFactors: () => {
            const error = new Error('Forbidden resource access');
            error.statusCode = 403;
            throw error;
          },
        },
        pool,
      };

      const handler = new guardianFactorsTests.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('should get guardianFactors', async () => {
      const factors = [
        { name: 'sms', enabled: true },
        { name: 'push-notification', enabled: true },
        { name: 'otp', enabled: true },
        { name: 'email', enabled: true },
        { name: 'duo', enabled: false },
        { name: 'webauthn-roaming', enabled: false },
        { name: 'webauthn-platform', enabled: false },
        { name: 'recovery-code', enabled: false },
      ];

      const auth0 = {
        guardian: {
          getFactors: () => ({ data: [...factors] }),
        },
        pool,
      };

      const handler = new guardianFactorsTests.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal(sortGuardianFactors(factors));
    });

    it('should update factors', async () => {
      const factors = [
        { name: 'sms', enabled: true },
        { name: 'push-notification', enabled: true },
        { name: 'otp', enabled: true },
        { name: 'email', enabled: true },
        { name: 'duo', enabled: false },
        { name: 'webauthn-roaming', enabled: false },
        { name: 'webauthn-platform', enabled: false },
        { name: 'recovery-code', enabled: false },
      ];

      const auth0 = {
        guardian: {
          getFactors: () => [...factors],
          updateFactor: () => ({ enabled: true }),
        },
        pool,
      };

      const handler = new guardianFactorsTests.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'sms',
          enabled: false,
        },
      ];

      await stageFn.apply(handler, [{ guardianFactors: data }]);
    });
  });

  describe('#guardianFactors dryRunChanges', () => {
    let handler;
    let stageFn;
    let contextDataMock;

    const dryRunConfig = (key) => {
      if (key === 'AUTH0_DRY_RUN') return true;
      return dryRunConfig.data && dryRunConfig.data[key];
    };
    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    beforeEach(() => {
      contextDataMock = {
        guardianFactors: [
          { name: 'sms', enabled: true },
          { name: 'otp', enabled: false },
        ],
      };

      stageFn = (params) => {
        const { repository, mappings } = params;
        if (repository && mappings) {
          return contextDataMock;
        }
        return {};
      };

      handler = new guardianFactorsTests.default({
        client: {},
        config: dryRunConfig,
        stageFn,
      });

      handler.existing = [
        { name: 'sms', enabled: false },
        { name: 'otp', enabled: false },
        { name: 'duo', enabled: false },
      ];
    });

    it('should return no create changes (guardianFactors cannot be created)', async () => {
      contextDataMock.guardianFactors = [
        { name: 'unknown-factor', enabled: true }, // Factor not in existing - should be ignored
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1); // Will be treated as update since it uses standard calcChanges
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return update changes for existing guardianFactors with differences', async () => {
      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1); // Only sms has differences (otp doesn't exist in this.existing)
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no delete changes (guardianFactors cannot be deleted)', async () => {
      contextDataMock.guardianFactors = []; // Empty array will trigger deletes for existing factors

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(3); // All existing factors would be flagged for deletion
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when guardianFactors are identical', async () => {
      contextDataMock.guardianFactors = [
        { name: 'sms', enabled: false },
        { name: 'otp', enabled: false },
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle mixed update scenarios', async () => {
      contextDataMock.guardianFactors = [
        { name: 'sms', enabled: true }, // Different from existing (false)
        { name: 'otp', enabled: false }, // Same as existing
        { name: 'duo', enabled: true }, // Different from existing (false)
      ];

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(2); // sms and duo changed
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const changes = await handler.dryRunChanges({});

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });

  describe('#guardianFactors processChanges dryrun tests', () => {
    it('should update guardian factors during dry run without making API calls', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getFactors: stub().returns(
            Promise.resolve({ data: [mockFactorSms({ enabled: false })] })
          ),
          updateFactor: stub().returns(
            Promise.reject(new Error('updateFactor should not have been called'))
          ),
        },
      };

      const handler = new GuardianFactorsHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = { guardianFactors: [mockFactorSms({ enabled: true })] };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(1);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getFactors.called).to.equal(true);
      expect(auth0.guardian.updateFactor.called).to.equal(false);
    });

    it('should not update identical guardian factors during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getFactors: stub().returns(Promise.resolve({ data: [mockFactorSms({ enabled: true })] })),
          updateFactor: stub().returns(
            Promise.reject(new Error('updateFactor should not have been called'))
          ),
        },
      };

      const handler = new GuardianFactorsHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = { guardianFactors: [mockFactorSms({ enabled: true })] };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getFactors.called).to.equal(true);
      expect(auth0.guardian.updateFactor.called).to.equal(false);
    });

    it('should update multiple guardian factors during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getFactors: stub().returns(
            Promise.resolve({
              data: [mockFactorSms({ enabled: false }), mockFactorDuo({ enabled: false })],
            })
          ),
          updateFactor: stub().returns(
            Promise.reject(new Error('updateFactor should not have been called'))
          ),
        },
      };

      const handler = new GuardianFactorsHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {
        guardianFactors: [mockFactorSms({ enabled: true }), mockFactorDuo({ enabled: true })],
      };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(2);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getFactors.called).to.equal(true);
      expect(auth0.guardian.updateFactor.called).to.equal(false);
    });

    it('should handle mixed changes during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getFactors: stub().returns(
            Promise.resolve({
              data: [mockFactorSms({ enabled: true }), mockFactorDuo({ enabled: false })],
            })
          ),
          updateFactor: stub().returns(
            Promise.reject(new Error('updateFactor should not have been called'))
          ),
        },
      };

      const handler = new GuardianFactorsHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {
        guardianFactors: [
          mockFactorSms({ enabled: true }), // no change
          mockFactorDuo({ enabled: true }), // update needed
        ],
      };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(1);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getFactors.called).to.equal(true);
      expect(auth0.guardian.updateFactor.called).to.equal(false);
    });

    it('should handle empty guardian factors during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getFactors: stub().returns(Promise.resolve({ data: [] })),
          updateFactor: stub().returns(
            Promise.reject(new Error('updateFactor should not have been called'))
          ),
        },
      };

      const handler = new GuardianFactorsHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = { guardianFactors: [] };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getFactors.called).to.equal(false);
      expect(auth0.guardian.updateFactor.called).to.equal(false);
    });

    it('should handle no guardian factors config during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getFactors: stub().returns(
            Promise.reject(new Error('getFactors should not have been called'))
          ),
          updateFactor: stub().returns(
            Promise.reject(new Error('updateFactor should not have been called'))
          ),
        },
      };

      const handler = new GuardianFactorsHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {};

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getFactors.called).to.equal(false);
      expect(auth0.guardian.updateFactor.called).to.equal(false);
    });
  });
});
