const { expect } = require('chai');
const riskAssessmentsNewDevice = require('../../../../src/tools/auth0/handlers/riskAssessmentsNewDevice');

describe('#riskAssessmentsNewDevice handler', () => {
  describe('#riskAssessmentsNewDevice getType', () => {
    it('should get risk assessments new device settings', async () => {
      const auth0 = {
        riskAssessments: {
          getNewDeviceSettings: () => ({ data: { remember_for: 30 } }),
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ remember_for: 30 });
    });

    it('should return default settings when not found', async () => {
      const auth0 = {
        riskAssessments: {
          getNewDeviceSettings: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          },
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ remember_for: 0 });
    });

    it('should cache existing settings', async () => {
      let callCount = 0;
      const auth0 = {
        riskAssessments: {
          getNewDeviceSettings: () => {
            callCount += 1;
            return { data: { remember_for: 30 } };
          },
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      await handler.getType();
      await handler.getType();
      expect(callCount).to.equal(1);
    });
  });

  describe('#riskAssessmentsNewDevice processChanges', () => {
    it('should update risk assessments new device settings', async () => {
      const auth0 = {
        riskAssessments: {
          updateNewDeviceSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.remember_for).to.equal(30);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ riskAssessmentsNewDevice: { remember_for: 30 } }]);
      expect(handler.updated).to.equal(1);
    });

    it('should update risk assessments new device settings to zero', async () => {
      const auth0 = {
        riskAssessments: {
          updateNewDeviceSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.remember_for).to.equal(0);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ riskAssessmentsNewDevice: { remember_for: 0 } }]);
      expect(handler.updated).to.equal(1);
    });

    it('should update risk assessments new device settings with different values', async () => {
      const auth0 = {
        riskAssessments: {
          updateNewDeviceSettings: (data) => {
            expect(data).to.be.an('object');
            expect(data.remember_for).to.equal(90);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ riskAssessmentsNewDevice: { remember_for: 90 } }]);
      expect(handler.updated).to.equal(1);
    });

    it('should not process changes if riskAssessmentsNewDevice is not provided', async () => {
      const auth0 = {
        riskAssessments: {
          updateNewDeviceSettings: () => {
            throw new Error('updateNewDeviceSettings should not be called');
          },
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{}]);
      expect(handler.updated).to.equal(0);
    });

    it('should handle API errors properly', async () => {
      const auth0 = {
        riskAssessments: {
          updateNewDeviceSettings: () => {
            const error = new Error('API Error');
            error.statusCode = 500;
            throw error;
          },
        },
      };

      const handler = new riskAssessmentsNewDevice.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [{ riskAssessmentsNewDevice: { remember_for: 30 } }]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('API Error');
      }
    });
  });
});
