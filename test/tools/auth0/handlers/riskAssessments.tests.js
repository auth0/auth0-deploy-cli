const { expect } = require('chai');
const riskAssessments = require('../../../../src/tools/auth0/handlers/riskAssessments');

describe('#riskAssessments handler', () => {
  describe('#riskAssessments getType', () => {
    it('should get risk assessments settings', async () => {
      const auth0 = {
        riskAssessments: {
          getSettings: () => ({ data: { enabled: true } }),
        },
      };

      const handler = new riskAssessments.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ enabled: true });
    });

    it('should return default settings when not found', async () => {
      const auth0 = {
        riskAssessments: {
          getSettings: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          },
        },
      };

      const handler = new riskAssessments.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ enabled: false });
    });
  });

  describe('#riskAssessments processChanges', () => {
    it('should update risk assessments settings to enabled', async () => {
      const auth0 = {
        riskAssessments: {
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.enabled).to.equal(true);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new riskAssessments.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ riskAssessments: { enabled: true } }]);
      expect(handler.updated).to.equal(1);
    });

    it('should update risk assessments settings to disabled', async () => {
      const auth0 = {
        riskAssessments: {
          updateSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.enabled).to.equal(false);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new riskAssessments.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ riskAssessments: { enabled: false } }]);
      expect(handler.updated).to.equal(1);
    });

    it('should not process changes if riskAssessments is not provided', async () => {
      const auth0 = {
        riskAssessments: {
          updateSettings: () => {
            throw new Error('updateSettings should not be called');
          },
        },
      };

      const handler = new riskAssessments.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{}]);
      expect(handler.updated).to.equal(0);
    });

    it('should handle API errors properly', async () => {
      const auth0 = {
        riskAssessments: {
          updateSettings: () => {
            const error = new Error('API Error');
            error.statusCode = 500;
            throw error;
          },
        },
      };

      const handler = new riskAssessments.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [{ riskAssessments: { enabled: true } }]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('API Error');
      }
    });
  });
});
