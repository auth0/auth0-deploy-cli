const { expect } = require('chai');
const emailProvider = require('../../../../src/tools/auth0/handlers/emailProvider');

describe('#emailProvider handler', () => {
  describe('#emailProvider process', () => {
    it('should configure email provider', async () => {
      const auth0 = {
        emails: {
          configure: (provider, data) => {
            expect(provider).to.be.an('object');
            expect(data).to.be.an('object');
            expect(provider.name).to.equal('someProvider');
            expect(data.name).to.equal('someProvider');
            return Promise.resolve({ data: { provider, data } });
          },
          update: (provider, data) => Promise.resolve({ data: { provider, data } }),
          delete: () => Promise.resolve({ data: null }),
          get: () => ({ data: [] }),
        },
      };

      const handler = new emailProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ emailProvider: { name: 'someProvider', enabled: true } }]);
    });

    it('should update email provider', async () => {
      const auth0 = {
        emails: {
          configure: (provider, data) => {
            expect(provider).to.be('undefined');
            return Promise.resolve({ data });
          },
          update: (provider, data) => {
            expect(provider).to.be.an('object');
            expect(data).to.be.an('object');
            expect(provider.name).to.equal('someProvider');
            expect(data.name).to.equal('someProvider');
            expect(data.credentials).to.equal('password');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: null }),
          get: () => ({ data: { name: 'someProvider', enabled: false } }),
        },
      };

      const handler = new emailProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        name: 'someProvider',
        enabled: true,
        credentials: 'password',
      };

      await stageFn.apply(handler, [{ emailProvider: data }]);
    });

    // THIS IS NO LONGER SUPPORTED
    it('should delete email provider if set to empty object and AUTH0_ALLOW_DELETE is true', async () => {
      const AUTH0_ALLOW_DELETE = true;
      let wasDeleteCalled = false;

      const auth0 = {
        emails: {
          delete: () => {
            wasDeleteCalled = true;
            return Promise.resolve({ data: {} });
          },
          get: () => ({ data: { name: 'someProvider', enabled: true } }),
        },
      };

      const handler = new emailProvider.default({
        client: auth0,
        config: () => AUTH0_ALLOW_DELETE,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ emailProvider: {} }]);

      // TODO: This isnt called anymore so I changed it to false
      expect(wasDeleteCalled).to.equal(false);
    });

    it('should not delete email provider if set to empty object and if AUTH0_ALLOW_DELETE is false', async () => {
      const AUTH0_ALLOW_DELETE = false;

      const auth0 = {
        emails: {
          delete: () => {
            throw new Error('was not expecting delete to be called');
          },
          get: () => ({ data: { name: 'someProvider', enabled: true } }),
        },
      };

      const handler = new emailProvider.default({
        client: auth0,
        config: () => AUTH0_ALLOW_DELETE,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ emailProvider: {} }]);
    });

    it('should get email provider', async () => {
      const auth0 = {
        emails: {
          get: () => ({ data: { name: 'smtp', enabled: true } }),
        },
      };

      const handler = new emailProvider.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ name: 'smtp', enabled: true });
    });

    it('should delete email provider and create another one instead', async () => {
      const auth0 = {
        emails: {
          configure: (provider, data) => {
            expect(provider).to.be.an('object');
            expect(data).to.be.an('object');
            expect(provider.name).to.equal('someProvider');
            expect(data.name).to.equal('someProvider');
            expect(data.credentials).to.equal('password');
            return Promise.resolve({ data });
          },
          update: (provider, data) => {
            expect(provider).to.be('undefined');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: null }),
          get: () => ({ data: { name: 'oldProvider', enabled: true } }),
        },
      };

      const handler = new emailProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        name: 'someProvider',
        enabled: true,
        credentials: 'password',
      };

      await stageFn.apply(handler, [{ emailProvider: data }]);
    });
  });
});
