const { expect } = require('chai');
const emailProvider = require('../../../../src/tools/auth0/handlers/emailProvider');

describe('#emailProvider handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_DRY_RUN: false,
  };

  describe('#emailProvider process', () => {
    it('should configure email provider', async () => {
      const auth0 = {
        emails: {
          configure: (data) => {
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someProvider');
            return Promise.resolve({ data });
          },
          update: (data) => Promise.resolve({ data }),
          delete: () => Promise.resolve({ data: null }),
          get: () => ({ data: [] }),
        },
      };

      const handler = new emailProvider.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ emailProvider: { name: 'someProvider', enabled: true } }]);
    });

    it('should update email provider', async () => {
      const auth0 = {
        emails: {
          configure: (data) => Promise.resolve({ data }),
          update: (data) => {
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someProvider');
            expect(data.credentials).to.equal('password');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: null }),
          get: () => ({ data: { name: 'someProvider', enabled: false } }),
        },
      };

      const handler = new emailProvider.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        name: 'someProvider',
        enabled: true,
        credentials: 'password',
      };

      await stageFn.apply(handler, [{ emailProvider: data }]);
    });

    // THIS IS NO LONGER SUPPORTED
    it('should disable instead of delete email provider if set to empty object and AUTH0_ALLOW_DELETE is true', async () => {
      config.data = {
        AUTH0_ALLOW_DELETE: true,
      };
      let wasDeleteCalled = false;
      let wasUpdateCalled = false;
      const auth0 = {
        emails: {
          delete: () => {
            wasDeleteCalled = true;
            return Promise.resolve({ data: {} });
          },
          update: () => {
            wasUpdateCalled = true;
            return Promise.resolve({ data: {} });
          },
          get: () => ({ data: { name: 'someProvider', enabled: true } }),
        },
      };

      const handler = new emailProvider.default({
        client: auth0,
        config,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ emailProvider: {} }]);

      expect(wasDeleteCalled).to.equal(false);
      expect(wasUpdateCalled).to.equal(true);
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
          configure: (data) => {
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someProvider');
            expect(data.credentials).to.equal('password');
            return Promise.resolve({ data });
          },
          update: (data) => Promise.resolve({ data }),
          delete: () => Promise.resolve({ data: null }),
          get: () => ({ data: { name: 'oldProvider', enabled: true } }),
        },
      };

      const handler = new emailProvider.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        name: 'someProvider',
        enabled: true,
        credentials: 'password',
      };

      await stageFn.apply(handler, [{ emailProvider: data }]);
    });
  });

  describe('#emailProvider dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return update changes for emailProvider with differences', async () => {
      const existingProvider = {
        name: 'smtp',
        enabled: false,
        default_from_address: 'old@example.com',
      };

      const auth0 = {
        emails: {
          get: () => Promise.resolve({ data: existingProvider }),
        },
      };

      const handler = new emailProvider.default({ client: auth0, config: dryRunConfig });
      const assets = {
        emailProvider: {
          name: 'smtp',
          enabled: true,
          default_from_address: 'new@example.com',
        },
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when emailProvider is identical', async () => {
      const existingProvider = {
        name: 'smtp',
        enabled: true,
        default_from_address: 'same@example.com',
      };

      const auth0 = {
        emails: {
          get: () => Promise.resolve({ data: existingProvider }),
        },
      };

      const handler = new emailProvider.default({ client: auth0, config: dryRunConfig });
      const assets = {
        emailProvider: {
          name: 'smtp',
          enabled: true,
          default_from_address: 'same@example.com',
        },
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const existingProvider = {
        name: 'smtp',
        enabled: true,
      };

      const auth0 = {
        emails: {
          get: () => Promise.resolve({ data: existingProvider }),
        },
      };

      const handler = new emailProvider.default({ client: auth0, config: dryRunConfig });
      const assets = {}; // No emailProvider property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
