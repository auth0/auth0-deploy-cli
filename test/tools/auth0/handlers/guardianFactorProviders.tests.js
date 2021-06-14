const { expect } = require('chai');

const guardianFactorProvidersTests = require('../../../../src/tools/auth0/handlers/guardianFactorProviders');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  }
};

describe('#guardianFactorProviders handler', () => {
  const config = function(key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true
  };

  describe('#guardianFactorProviders validate', () => {
    it('should not allow same names', async () => {
      const handler = new guardianFactorProvidersTests.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'sms',
          provider: 'twilio'
        },
        {
          name: 'sms',
          provider: 'twilio'
        }

      ];

      try {
        await stageFn.apply(handler, [ { guardianFactorProviders: data } ]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new guardianFactorProvidersTests.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'sms',
          provider: 'test'
        }
      ];

      await stageFn.apply(handler, [ { guardianFactorProviders: data } ]);
    });
  });

  describe('#guardianFactorProviders process', () => {
    it('should get guardianFactorProviders', async () => {
      const auth0 = {
        guardian: {
          getFactorProvider: (params) => ({ ...params, test: 'data' })
        },
        pool
      };

      const handler = new guardianFactorProvidersTests.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { name: 'sms', provider: 'twilio', test: 'data' },
        { name: 'push-notification', provider: 'sns', test: 'data' }
      ]);
    });

    it('should update guardianFactorProviders', async () => {
      const provider = {
        name: 'sms',
        provider: 'twilio',
        auth_token: 'test',
        sid: 'test',
        from: null,
        messaging_service_sid: 'test'
      };

      const auth0 = {
        guardian: {
          updateFactorProvider: () => ({ ...provider })
        },
        pool
      };

      const handler = new guardianFactorProvidersTests.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'sms',
          enabled: false
        }
      ];

      await stageFn.apply(handler, [ { guardianFactorProviders: data } ]);
    });
  });
});
