const { expect } = require('chai');
const guardianPolicies = require('../../../../src/tools/auth0/handlers/guardianPolicies');

describe('#guardianPolicies handler', () => {
  describe('#getType', () => {
    it('should support older version of auth0 client', async () => {
      const auth0 = {
        guardian: {
          policies: {
            list: () => Promise.resolve([]),
          },
        },
      };

      const handler = new guardianPolicies.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ policies: [] });
    });

    it('should get guardian policies', async () => {
      const auth0 = {
        guardian: {
          policies: {
            list: () => Promise.resolve(['all-applications']),
          },
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
          policies: {
            set: (data) => {
              expect(data).to.be.an('array');
              expect(data[0]).to.equal('all-applications');
              return Promise.resolve(data);
            },
          },
        },
      };

      const handler = new guardianPolicies.default({ client: auth0 });
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
          policies: {
            set: () => {
              const err = new Error('set() should not have been called');
              return Promise.reject(err);
            },
          },
        },
      };

      const handler = new guardianPolicies.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianPolicies: {} }]);
    });
  });
});
