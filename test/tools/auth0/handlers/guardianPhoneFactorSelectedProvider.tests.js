const { expect } = require('chai');
const guardianPhoneFactorSelectedProvider = require('../../../../src/tools/auth0/handlers/guardianPhoneFactorSelectedProvider');

describe('#guardianPhoneFactorSelectedProvider handler', () => {
  describe('#getType', () => {
    it('should support older version of auth0 client', async () => {
      const auth0 = {
        guardian: {
          // omitting getPhoneFactorSelectedProvider()
        },
      };

      const handler = new guardianPhoneFactorSelectedProvider.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should support when endpoint does not exist (older installations)', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorSelectedProvider: () => {
            const err = new Error('Not Found');
            err.name = 'Not Found';
            err.statusCode = 404;
            err.requestInfo = {
              method: 'get',
              url: 'https://example.auth0.com/api/v2/guardian/factors/sms/selected-provider',
            };
            err.originalError = new Error('Not Found');
            err.originalError.status = 404;
            err.originalError.response = {
              body: {
                statusCode: 404,
                error: 'Not Found',
                message: 'Not Found',
              },
            };
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianPhoneFactorSelectedProvider.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should support when endpoint is disabled for tenant', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorSelectedProvider: () => {
            const err = new Error('This endpoint is disabled for your tenant.');
            err.name = 'Forbidden';
            err.statusCode = 403;
            err.requestInfo = {
              method: 'get',
              url: 'https://example.auth0.com/api/v2/guardian/factors/sms/selected-provider',
            };
            err.originalError = new Error('Forbidden');
            err.originalError.status = 403;
            err.originalError.response = {
              body: {
                statusCode: 403,
                error: 'Forbidden',
                message: 'This endpoint is disabled for your tenant.',
                errorCode: 'hooks_not_allowed',
              },
            };
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianPhoneFactorSelectedProvider.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should get guardian phone factor selected provider', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorSelectedProvider: () => ({ data: { provider: 'twilio' } }),
        },
      };

      const handler = new guardianPhoneFactorSelectedProvider.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ provider: 'twilio' });
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorSelectedProvider: () => {
            const error = new Error('Bad request');
            error.statusCode = 500;
            throw error;
          },
        },
      };

      const handler = new guardianPhoneFactorSelectedProvider.default({ client: auth0 });
      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
      }
    });
  });

  describe('#processChanges', () => {
    it('should update guardian phone factor selected provider', async () => {
      const auth0 = {
        guardian: {
          updatePhoneFactorSelectedProvider: (data) => {
            expect(data).to.eql({ provider: 'twilio' });
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new guardianPhoneFactorSelectedProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { guardianPhoneFactorSelectedProvider: { provider: 'twilio' } },
      ]);
    });

    it('should skip processing if assets are empty', async () => {
      const auth0 = {
        guardian: {
          updatePhoneFactorSelectedProvider: () => {
            const err = new Error(
              'updatePhoneFactorSelectedProvider() should not have been called'
            );
            return Promise.reject(err);
          },
        },
      };

      const handler = new guardianPhoneFactorSelectedProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ guardianPhoneFactorSelectedProvider: null }]);
    });
  });
});
