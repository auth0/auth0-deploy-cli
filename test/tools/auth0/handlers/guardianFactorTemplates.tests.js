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
    it('should get guardianFactorTemplates', async () => {
      const auth0 = {
        guardian: {
          getSmsFactorTemplates: (params) => ({ data: { ...params, enrollment_message: 'test' }}),
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
          setSmsFactorTemplates: (params, data) => ({ data }),
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
  });
});
