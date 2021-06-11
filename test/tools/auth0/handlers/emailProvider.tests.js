const { expect } = require('chai');
const emailProvider = require('../../../../src/tools/auth0/handlers/emailProvider');

describe('#emailProvider handler', () => {
  describe('#emailProvider process', () => {
    it('should configure email provider', async () => {
      const auth0 = {
        emailProvider: {
          configure: (provider, data) => {
            expect(provider).to.be.an('object');
            expect(data).to.be.an('object');
            expect(provider.name).to.equal('someProvider');
            expect(data.name).to.equal('someProvider');
            return Promise.resolve({ provider, data });
          },
          update: (provider, data) => Promise.resolve({ provider, data }),
          delete: () => Promise.resolve(null),
          get: () => []
        }
      };

      const handler = new emailProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { emailProvider: { name: 'someProvider', enabled: true } } ]);
    });

    it('should update email provider', async () => {
      const auth0 = {
        emailProvider: {
          configure: (provider, data) => {
            expect(provider).to.be('undefined');
            return Promise.resolve(data);
          },
          update: (provider, data) => {
            expect(provider).to.be.an('object');
            expect(data).to.be.an('object');
            expect(provider.name).to.equal('someProvider');
            expect(data.name).to.equal('someProvider');
            expect(data.credentials).to.equal('password');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve(null),
          get: () => ({ name: 'someProvider', enabled: false })
        }
      };

      const handler = new emailProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        name: 'someProvider',
        enabled: true,
        credentials: 'password'
      };

      await stageFn.apply(handler, [ { emailProvider: data } ]);
    });

    it('should get email provider', async () => {
      const auth0 = {
        emailProvider: {
          get: () => ({ name: 'smtp', enabled: true })
        }
      };

      const handler = new emailProvider.default({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({ name: 'smtp', enabled: true });
    });

    it('should delete email provider and create another one instead', async () => {
      const auth0 = {
        emailProvider: {
          configure: (provider, data) => {
            expect(provider).to.be.an('object');
            expect(data).to.be.an('object');
            expect(provider.name).to.equal('someProvider');
            expect(data.name).to.equal('someProvider');
            expect(data.credentials).to.equal('password');
            return Promise.resolve(data);
          },
          update: (provider, data) => {
            expect(provider).to.be('undefined');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve(null),
          get: () => ({ name: 'oldProvider', enabled: true })
        }
      };

      const handler = new emailProvider.default({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        name: 'someProvider',
        enabled: true,
        credentials: 'password'
      };

      await stageFn.apply(handler, [ { emailProvider: data } ]);
    });
  });
});
