const { expect } = require('chai');
const guardianPhoneFactorMessageTypes = require('../../../../src/tools/auth0/handlers/guardianPhoneFactorMessageTypes');

describe('#guardianPhoneFactorMessageTypes handler', () => {
  describe('#getType', () => {
    it('should support older version of auth0 client', async () => {
      const auth0 = {
        guardian: {
          // omitting getPhoneFactorMessageTypes()
        }
      };

      const handler = new guardianPhoneFactorMessageTypes.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({});
    });

    it('should support when endpoint does not exist (older installations)', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorMessageTypes: () => {
            const err = new Error('Not Found');
            err.name = 'Not Found';
            err.statusCode = 404;
            err.requestInfo = {
              method: 'get',
              url: 'https://example.auth0.com/api/v2/guardian/factors/phone/message-types'
            };
            err.originalError = new Error('Not Found');
            err.originalError.status = 404;
            err.originalError.response = {
              body: {
                statusCode: 404,
                error: 'Not Found',
                message: 'Not Found'
              }
            };
            return Promise.reject(err);
          }
        }
      };

      const handler = new guardianPhoneFactorMessageTypes.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({});
    });

    it('should support when endpoint is disabled for tenant', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorMessageTypes: () => {
            const err = new Error('This endpoint is disabled for your tenant.');
            err.name = 'Forbidden';
            err.statusCode = 403;
            err.requestInfo = {
              method: 'get',
              url: 'https://example.auth0.com/api/v2/guardian/factors/phone/message-types'
            };
            err.originalError = new Error('Forbidden');
            err.originalError.status = 403;
            err.originalError.response = {
              body: {
                statusCode: 403,
                error: 'Forbidden',
                message: 'This endpoint is disabled for your tenant.',
                errorCode: 'voice_mfa_not_allowed'
              }
            };
            return Promise.reject(err);
          }
        }
      };

      const handler = new guardianPhoneFactorMessageTypes.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({});
    });

    it('should get guardian phone factor message types', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorMessageTypes: () => ({ message_types: [ 'sms', 'voice' ] })
        }
      };

      const handler = new guardianPhoneFactorMessageTypes.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ message_types: [ 'sms', 'voice' ] });
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        guardian: {
          getPhoneFactorMessageTypes: () => {
            const error = new Error('Bad request');
            error.statusCode = 500;
            throw error;
          }
        }
      };

      const handler = new guardianPhoneFactorMessageTypes.default({ client: auth0 });
      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
      }
    });
  });

  describe('#processChanges', () => {
    it('should update guardian phone factor message types', async () => {
      const auth0 = {
        guardian: {
          updatePhoneFactorMessageTypes: (params, data) => {
            expect(data).to.eql({ message_types: [ 'sms', 'voice' ] });
            return Promise.resolve(data);
          }
        }
      };

      const handler = new guardianPhoneFactorMessageTypes.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { guardianPhoneFactorMessageTypes: { message_types: [ 'sms', 'voice' ] } }
      ]);
    });

    it('should skip processing if assets are empty', async () => {
      const auth0 = {
        guardian: {
          updatePhoneFactorMessageTypes: () => {
            const err = new Error('updatePhoneFactorMessageTypes() should not have been called');
            return Promise.reject(err);
          }
        }
      };

      const handler = new guardianPhoneFactorMessageTypes.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { guardianPhoneFactorMessageTypes: {} }
      ]);
    });
  });
});
