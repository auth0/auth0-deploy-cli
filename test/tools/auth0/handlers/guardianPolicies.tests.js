const { expect } = require('chai');
const sinon = require('sinon');
const guardianPolicies = require('../../../../src/tools/auth0/handlers/guardianPolicies');
const {
  default: GuardianPoliciesHandler,
} = require('../../../../src/tools/auth0/handlers/guardianPolicies');

describe('#guardianPolicies handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_DRY_RUN: false,
  };

  describe('#getType', () => {
    it('should support older version of auth0 client', async () => {
      const auth0 = {
        guardian: {
          // omitting getPolicies()
        },
      };

      const handler = new guardianPolicies.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({});
    });

    it('should get guardian policies', async () => {
      const auth0 = {
        guardian: {
          getPolicies: () => ({ data: ['all-applications'] }),
        },
      };

      const handler = new guardianPolicies.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        policies: ['all-applications'],
      });
    });
  });

  describe('#processChanges', () => {
    it('should update guardian policies settings', async () => {
      const auth0 = {
        guardian: {
          updatePolicies: (data) => {
            expect(data).to.be.an('array');
            expect(data[0]).to.equal('all-applications');
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new guardianPolicies.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          guardianPolicies: {
            policies: ['all-applications'],
          },
        },
      ]);
    });

    it('should skip processing if assets are empty', async () => {
      const auth0 = {
        guardian: {
          updatePolicies: () => {
            const err = new Error('updatePolicies() should not have been called');
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianPolicies.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianPolicies: {} }]);
    });
  });

  describe('#guardianPolicies dryRunChanges', () => {
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
        guardianPolicies: {
          policies: ['all-applications', 'confidence-score'],
        },
      };

      stageFn = (params) => {
        const { repository, mappings } = params;
        if (repository && mappings) {
          return contextDataMock;
        }
        return {};
      };

      handler = new guardianPolicies.default({
        client: {},
        config: dryRunConfig,
        stageFn,
      });

      // Override getType to return the proper existing data structure
      handler.getType = async () => ({ policies: ['all-applications'] });
    });

    it('should return update changes for guardianPolicies with differences', async () => {
      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.del).to.have.length(0);
      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when guardianPolicies is identical', async () => {
      contextDataMock.guardianPolicies = {
        policies: ['all-applications'],
      };

      const changes = await handler.dryRunChanges(contextDataMock);

      expect(changes.del).to.have.length(0);
      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const changes = await handler.dryRunChanges({});

      expect(changes.del).to.have.length(0);
      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });

  describe('#guardianPolicies processChanges dryrun tests', () => {
    it('should update guardian policies during dry run without making API calls', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getPolicies: sinon.stub().returns(Promise.resolve({ data: ['all-applications'] })),
          updatePolicies: sinon
            .stub()
            .returns(Promise.reject(new Error('updatePolicies should not have been called'))),
        },
      };

      const handler = new GuardianPoliciesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = { guardianPolicies: { policies: ['per-application'] } };

      // Use dryRunChanges instead of processChanges for dry run testing
      const changes = await handler.dryRunChanges(assets);

      expect(changes.update).to.have.length(1);
      expect(changes.create).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(auth0.guardian.getPolicies.called).to.equal(true);
      expect(auth0.guardian.updatePolicies.called).to.equal(false);
    });

    it('should not update identical guardian policies during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getPolicies: sinon.stub().returns(Promise.resolve({ data: ['all-applications'] })),
          updatePolicies: sinon
            .stub()
            .returns(Promise.reject(new Error('updatePolicies should not have been called'))),
        },
      };

      const handler = new GuardianPoliciesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = { guardianPolicies: { policies: ['all-applications'] } };

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getPolicies.called).to.equal(true);
      expect(auth0.guardian.updatePolicies.called).to.equal(false);
    });

    it('should handle no guardian policies config during dry run', async () => {
      const dryRunConfig = {
        AUTH0_DRY_RUN: true,
      };

      const auth0 = {
        guardian: {
          getPolicies: sinon
            .stub()
            .returns(Promise.reject(new Error('getPolicies should not have been called'))),
          updatePolicies: sinon
            .stub()
            .returns(Promise.reject(new Error('updatePolicies should not have been called'))),
        },
      };

      const handler = new GuardianPoliciesHandler({
        client: auth0,
        config: (key) => dryRunConfig[key],
      });
      const assets = {};

      await handler.processChanges(assets);

      expect(handler.updated).to.equal(0);
      expect(handler.created).to.equal(0);
      expect(handler.deleted).to.equal(0);
      expect(auth0.guardian.getPolicies.called).to.equal(false);
      expect(auth0.guardian.updatePolicies.called).to.equal(false);
    });
  });
});
