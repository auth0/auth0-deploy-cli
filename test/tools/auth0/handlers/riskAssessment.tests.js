const { expect } = require('chai');
const { ManagementError } = require('auth0');
const riskAssessment = require('../../../../src/tools/auth0/handlers/riskAssessment');

describe('#riskAssessment handler', () => {
  describe('#riskAssessment getType', () => {
    it('should get risk assessments settings', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            get: () => Promise.resolve({ enabled: true }),
            newDevice: {
              get: () => Promise.resolve({ remember_for: 30 }),
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        settings: { enabled: true },
        new_device: { remember_for: 30 },
      });
    });

    it('should get risk assessments settings without newDevice when remember_for is 0', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            get: () => Promise.resolve({ enabled: true }),
            newDevice: {
              get: () => Promise.resolve({ remember_for: 0 }),
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        settings: { enabled: true },
        new_device: { remember_for: 0 },
      });
    });

    it('should return default settings when not found', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            get: () => {
              const error = new ManagementError('Not found');
              error.statusCode = 404;
              return Promise.reject(error);
            },
            newDevice: {
              get: () => {
                const error = new ManagementError('Not found');
                error.statusCode = 404;
                return Promise.reject(error);
              },
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ settings: { enabled: false } });
    });
  });

  describe('#riskAssessment processChanges', () => {
    it('should update risk assessments settings to enabled', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            update: (data) => {
              expect(data).to.be.an('object');
              expect(data.enabled).to.equal(true);
              return Promise.resolve({ data });
            },
            newDevice: {
              update: () => {
                throw new Error('newDevice.update should not be called');
              },
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ riskAssessment: { settings: { enabled: true } } }]);
      expect(handler.updated).to.equal(1);
    });

    it('should update risk assessments settings with newDevice', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            update: (data) => {
              expect(data).to.be.an('object');
              expect(data.enabled).to.equal(true);
              return Promise.resolve({ data });
            },
            newDevice: {
              update: (data) => {
                expect(data).to.be.an('object');
                expect(data.remember_for).to.equal(30);
                return Promise.resolve({ data });
              },
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { riskAssessment: { settings: { enabled: true }, new_device: { remember_for: 30 } } },
      ]);
      expect(handler.updated).to.equal(1);
    });

    it('should update risk assessments settings to disabled', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            update: (data) => {
              expect(data).to.be.an('object');
              expect(data.enabled).to.equal(false);
              return Promise.resolve({ data });
            },
            newDevice: {
              update: () => {
                throw new Error('newDevice.update should not be called');
              },
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ riskAssessment: { settings: { enabled: false } } }]);
      expect(handler.updated).to.equal(1);
    });

    it('should not process changes if riskAssessment is not provided', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            update: () => {
              throw new Error('update should not be called');
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{}]);
      expect(handler.updated).to.equal(0);
    });

    it('should handle API errors properly', async () => {
      const auth0 = {
        riskAssessments: {
          settings: {
            update: () => {
              const error = new Error('API Error');
              error.statusCode = 500;
              throw error;
            },
            newDevice: {
              update: () => Promise.resolve(),
            },
          },
        },
      };

      const handler = new riskAssessment.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [{ riskAssessment: { settings: { enabled: true } } }]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('API Error');
      }
    });
  });
});
