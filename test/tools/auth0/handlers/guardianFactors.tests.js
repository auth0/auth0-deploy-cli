const { expect } = require('chai');
const guardianFactorsTests = require('../../../../src/tools/auth0/handlers/guardianFactors');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  }
};

describe('#guardianFactors handler', () => {
  const config = function(key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true
  };

  describe('#guardianFactors validate', () => {
    it('should not allow same names', async () => {
      const handler = new guardianFactorsTests.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'sms'
        },
        {
          name: 'sms'
        }
      ];

      try {
        await stageFn.apply(handler, [ { guardianFactors: data } ]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new guardianFactorsTests.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'sms'
        }
      ];

      await stageFn.apply(handler, [ { guardianFactors: data } ]);
    });
  });

  describe('#guardianFactors process', () => {
    it('should get guardianFactors', async () => {
      const factors = [
        { name: 'sms', enabled: true },
        { name: 'push-notification', enabled: true },
        { name: 'otp', enabled: true },
        { name: 'email', enabled: true },
        { name: 'duo', enabled: false },
        { name: 'webauthn-roaming', enabled: false },
        { name: 'webauthn-platform', enabled: false },
        { name: 'recovery-code', enabled: false }
      ];

      const auth0 = {
        guardian: {
          getFactors: () => [ ...factors ]
        },
        pool
      };

      const handler = new guardianFactorsTests.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal(factors);
    });

    it('should update factors', async () => {
      const factors = [
        { name: 'sms', enabled: true },
        { name: 'push-notification', enabled: true },
        { name: 'otp', enabled: true },
        { name: 'email', enabled: true },
        { name: 'duo', enabled: false },
        { name: 'webauthn-roaming', enabled: false },
        { name: 'webauthn-platform', enabled: false },
        { name: 'recovery-code', enabled: false }
      ];

      const auth0 = {
        guardian: {
          getFactors: () => [ ...factors ],
          updateFactor: () => ({ enabled: true })
        },
        pool
      };

      const handler = new guardianFactorsTests.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'sms',
          enabled: false
        }
      ];

      await stageFn.apply(handler, [ { guardianFactors: data } ]);
    });
  });
});
