const { expect } = require('chai');
const guardianPhoneFactorSettings = require('../../../../src/tools/auth0/handlers/guardianPhoneFactorSettings');

describe('#guardianPhoneFactorSettings handler', () => {
  describe('#getType', () => {
    it('should support older version of auth0 client (404)', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              get: () => {
                const err = new Error('Not Found');
                err.statusCode = 404;
                return Promise.reject(err);
              },
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should support when endpoint is disabled for tenant (403)', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              get: () => {
                const err = new Error('This endpoint is disabled for your tenant.');
                err.statusCode = 403;
                return Promise.reject(err);
              },
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should get guardian phone factor settings', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              get: () => Promise.resolve({ otp_length: 6, otp_expiration_time: 300 }),
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ otp_length: 6, otp_expiration_time: 300 });
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              get: () => {
                const error = new Error('Bad request');
                error.statusCode = 500;
                throw error;
              },
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      try {
        await handler.getType();
        throw new Error('Expected getType to throw');
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.statusCode).to.equal(500);
      }
    });
  });

  describe('#processChanges', () => {
    it('should update guardian phone factor settings', async () => {
      let called = false;
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              set: (data) => {
                called = true;
                expect(data).to.eql({ otp_length: 6, otp_expiration_time: 300 });
                return Promise.resolve(data);
              },
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { guardianPhoneFactorSettings: { otp_length: 6, otp_expiration_time: 300 } },
      ]);
      expect(called).to.equal(true);
      expect(handler.updated).to.equal(1);
    });

    it('should skip processing if assets are empty', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              set: () => Promise.reject(new Error('set() should not have been called')),
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianPhoneFactorSettings: null }]);
      expect(handler.updated).to.equal(0);
    });

    it('should warn and skip when the feature is not allowed on the tenant (403)', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              set: () => {
                const err = new Error('This endpoint is disabled for your tenant.');
                err.statusCode = 403;
                return Promise.reject(err);
              },
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      // Should resolve (not throw) even though the API rejects with a 403.
      await stageFn.apply(handler, [
        { guardianPhoneFactorSettings: { otp_length: 6, otp_expiration_time: 300 } },
      ]);
      expect(handler.updated).to.equal(0);
    });

    it('should not write when in dry-run mode and there are no changes', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              get: () => Promise.resolve({ otp_length: 6, otp_expiration_time: 300 }),
              set: () => Promise.reject(new Error('set() should not be called during dry-run')),
            },
          },
        },
      };

      const config = (key) => (key === 'AUTH0_DRY_RUN' ? true : null);
      const handler = new guardianPhoneFactorSettings.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { guardianPhoneFactorSettings: { otp_length: 6, otp_expiration_time: 300 } },
      ]);
      expect(handler.updated).to.equal(0);
    });

    it('should rethrow errors that are not feature-unavailable/forbidden', async () => {
      const auth0 = {
        guardian: {
          factors: {
            phone: {
              set: () => {
                const err = new Error('Internal Server Error');
                err.statusCode = 500;
                return Promise.reject(err);
              },
            },
          },
        },
      };

      const handler = new guardianPhoneFactorSettings.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [
          { guardianPhoneFactorSettings: { otp_length: 6, otp_expiration_time: 300 } },
        ]);
        throw new Error('Expected processChanges to throw');
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.statusCode).to.equal(500);
      }
      expect(handler.updated).to.equal(0);
    });
  });
});
