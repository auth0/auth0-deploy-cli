const { expect } = require('chai');
const clients = require('../../../../src/tools/auth0/handlers/clients');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  }
};

describe('#clients handler', () => {
  const config = function(key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true
  };

  describe('#clients validate', () => {
    it('should not allow same names', async () => {
      const handler = new clients.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someClient'
        },
        {
          name: 'someClient'
        }
      ];

      try {
        await stageFn.apply(handler, [ { clients: data } ]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new clients.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someClient'
        }
      ];

      await stageFn.apply(handler, [ { clients: data } ]);
    });
  });

  describe('#clients process', () => {
    it('should create client', async () => {
      const auth0 = {
        clients: {
          create: (data) => {
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someClient');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          getAll: () => []
        },
        pool
      };

      const handler = new clients.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { clients: [ { name: 'someClient' } ] } ]);
    });

    it('should get clients', async () => {
      const auth0 = {
        clients: {
          getAll: () => [
            { name: 'test client', client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV' },
            { name: 'deploy client', client_id: 'client_id' }
          ]
        },
        pool
      };

      const handler = new clients.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV', name: 'test client' },
        { client_id: 'client_id', name: 'deploy client' }
      ]);
    });

    it('should update client', async () => {
      const auth0 = {
        clients: {
          create: (data) => {
            expect(data).to.be.an('array');
            expect(data.length).to.equal(0);
            return Promise.resolve(data);
          },
          update: (params, data) => {
            expect(params).to.be.an('object');
            expect(params.client_id).to.equal('client1');
            expect(data).to.be.an('object');
            expect(data.description).to.equal('new description');

            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          getAll: () => [ { client_id: 'client1', name: 'someClient' } ]
        },
        pool
      };

      const handler = new clients.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { clients: [ { name: 'someClient', description: 'new description' } ] } ]);
    });

    it('should delete client and create another one instead', async () => {
      const auth0 = {
        clients: {
          create: (data) => {
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someClient');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('object');
            expect(params.client_id).to.equal('client1');
            return Promise.resolve([]);
          },
          getAll: () => [ { client_id: 'client1', name: 'existingClient' }, { client_id: 'client_id', name: 'deploy client' } ]

        },
        pool
      };

      const handler = new clients.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { clients: [ { name: 'someClient' } ] } ]);
    });

    it('should delete all clients', async () => {
      let removed = false;
      const auth0 = {
        clients: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('object');
            expect(params.client_id).to.equal('client1');
            removed = true;
            return Promise.resolve([]);
          },
          getAll: () => [ { client_id: 'client1', name: 'existingClient' }, { client_id: 'client_id', name: 'deploy client' } ]
        },
        pool
      };

      const handler = new clients.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { clients: [] } ]);
      expect(removed).to.equal(true);
    });

    it('should not remove client if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        clients: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [ { client_id: 'client1', name: 'existingClient' } ]
        },
        pool
      };

      const handler = new clients.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { clients: [ { name: 'newClient' } ] } ]);
    });

    it('should not remove, update or create client if it is excluded', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      const auth0 = {
        clients: {
          create: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          update: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [
            { client_id: 'client1', name: 'existingClient' },
            { client_id: 'client2', name: 'existingClient2' }
          ]
        },
        pool
      };

      const assets = {
        clients: [
          { name: 'excludedClient' },
          { name: 'existingClient' }
        ],
        exclude: {
          clients: [
            'excludedClient',
            'existingClient',
            'existingClient2'
          ]
        }
      };

      const handler = new clients.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ assets ]);
    });

    it('should not remove clients if run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret'
      };

      const auth0 = {
        clients: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [
            { client_id: 'client1', name: 'existingClient' },
            { client_id: 'client2', name: 'existingClient2' }
          ]
        },
        pool
      };

      const handler = new clients.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { clients: [] } ]);
    });
  });
});
