const { expect } = require('chai');

const guardianFactorTemplatesTests = require('../../../../src/tools/auth0/handlers/guardianFactorTemplates');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#guardianFactorTemplates handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#guardianFactorTemplates validate', () => {
    it('should not allow same names', async () => {
      const handler = new guardianFactorTemplatesTests.default({ client: {}, config });
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
        await stageFn.apply(handler, [{ guardianFactorTemplates: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new guardianFactorTemplatesTests.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'sms',
        },
      ];

      await stageFn.apply(handler, [{ guardianFactorTemplates: data }]);
    });
  });

  describe('#guardianFactorTemplates process', () => {
    it('should handle forbidden error', async () => {
      const auth0 = {
        guardian: {
          factors: {
            sms: {
              getTemplates: () => {
                const error = new Error('Forbidden resource access');
                error.statusCode = 403;
                throw error;
              },
            },
          },
        },
        pool,
      };

      const handler = new guardianFactorTemplatesTests.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('should get guardianFactorTemplates', async () => {
      const auth0 = {
        guardian: {
          factors: {
            sms: {
              getTemplates: () => Promise.resolve({ enrollment_message: 'test' }),
            },
          },
        },
        pool,
      };

      const handler = new guardianFactorTemplatesTests.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        {
          enrollment_message: 'test',
          name: 'sms',
        },
      ]);
    });

    it('should update guardianFactorTemplates', async () => {
      const auth0 = {
        guardian: {
          factors: {
            sms: {
              setTemplates: (data) => Promise.resolve(data),
            },
          },
        },
        pool,
      };

      const handler = new guardianFactorTemplatesTests.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'sms',
          enrollment_message: 'test',
        },
      ];

      await stageFn.apply(handler, [{ guardianFactorTemplates: data }]);
    });

    it('should warn and skip when the legacy feature is not allowed on the tenant', async () => {
      const auth0 = {
        guardian: {
          factors: {
            sms: {
              setTemplates: () => {
                const err = new Error(
                  'Insufficient privileges to use this deprecated feature. To handle Phone Provider/Templates refer to Tenant Phone Settings'
                );
                err.statusCode = 403;
                err.errorCode = 'legacy_mfa_phone_provider_not_allowed';
                return Promise.reject(err);
              },
            },
          },
        },
        pool,
      };

      const handler = new guardianFactorTemplatesTests.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'sms',
          enrollment_message: 'test',
        },
      ];

      // Should resolve (not throw) even though the API rejects with a 403.
      await stageFn.apply(handler, [{ guardianFactorTemplates: data }]);
      expect(handler.updated).to.equal(0);
    });
  });
});
