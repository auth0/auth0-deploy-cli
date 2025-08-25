import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const clientGrants = require('../../../../src/tools/auth0/handlers/clientGrants');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#clientGrants handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#clientGrants validate', () => {
    it('should not allow same names', async () => {
      const handler = new clientGrants.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someClientGrant',
        },
        {
          name: 'someClientGrant',
        },
      ];

      try {
        await stageFn.apply(handler, [{ clientGrants: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new clientGrants.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someClientGrant',
        },
      ];

      await stageFn.apply(handler, [{ clientGrants: data }]);
    });
  });

  describe('#clientGrants process', () => {
    it('should create client grants', async () => {
      const auth0 = {
        clientGrants: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someClientGrant');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'client_grants', []),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someClientGrant',
        },
      ];

      await stageFn.apply(handler, [{ clientGrants: data }]);
    });

    it('should get client grants', async () => {
      const clientId = 'rFeR6vyzQcDEgSUsASPeF4tXr3xbZhxE';
      const clientGrant = {
        audience: 'https://test.auth0.com/api/v2/',
        client_id: clientId,
        id: 'cgr_0TLisL4eNHzhSR6j',
        scope: ['read:logs'],
      };
      const auth0 = {
        clientGrants: {
          getAll: (params) => mockPagedData(params, 'client_grants', [clientGrant]),
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [{ name: 'test client', client_id: clientId }]),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([clientGrant]);
    });

    it('should convert client_name to client_id', async () => {
      const auth0 = {
        clientGrants: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someClientGrant');
            expect(data.client_id).to.equal('client_id');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'client_grants', []),
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client_id', name: 'client_name' }]),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someClientGrant',
          client_id: 'client_name',
        },
      ];

      await stageFn.apply(handler, [{ clientGrants: data }]);
    });

    it('should update client grant', async () => {
      const auth0 = {
        clientGrants: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data).to.equal({});
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('cg1');
            expect(data).to.be.an('object');
            expect(data.scope).to.be.an('array');
            expect(data.scope[0]).to.equal('read:messages');

            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'client_grants', [
              { id: 'cg1', client_id: 'client1', audience: 'audience' },
            ]),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          client_id: 'client1',
          audience: 'audience',
          scope: ['read:messages'],
        },
      ];

      await stageFn.apply(handler, [{ clientGrants: data }]);
    });

    it('should delete client grant and create another one instead', async () => {
      const auth0 = {
        clientGrants: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someClientGrant');
            expect(data.client_id).to.equal('client2');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('cg1');

            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'client_grants', [
              { id: 'cg1', client_id: 'client1', audience: 'audience1' },
            ]),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someClientGrant',
          client_id: 'client2',
          audience: 'audience2',
        },
      ];

      await stageFn.apply(handler, [{ clientGrants: data }]);
    });

    it('should not delete nor create client grant for own client', async () => {
      const auth0 = {
        clientGrants: {
          create: (params) => {
            expect(params).to.be.an('undefined');

            return Promise.resolve({ data: [] });
          },
          update: (params) => {
            expect(params).to.be.an('undefined');

            return Promise.resolve({ data: [] });
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');

            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'client_grants', [
              { id: 'id', client_id: 'client_id', audience: 'audience' },
            ]),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someClientGrant',
          client_id: 'client_id',
          audience: 'audience',
        },
      ];

      await stageFn.apply(handler, [{ clientGrants: data }]);
    });

    it('should delete all client grants', async () => {
      let removed = false;
      const auth0 = {
        clientGrants: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('cg1');
            removed = true;
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'client_grants', [
              { id: 'cg1', client_id: 'client1', audience: 'audience1' },
            ]),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clientGrants: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not delete client grants if run by extensions', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };

      const auth0 = {
        clientGrants: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');

            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'client_grants', [
              { id: 'cg1', client_id: 'client1', audience: 'audience1' },
            ]),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clientGrants: [] }]);
    });

    it('should not touch client grants of excluded clients', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };

      const auth0 = {
        clientGrants: {
          create: (params) => {
            expect(params).to.be.an('undefined');

            return Promise.resolve({ data: [] });
          },
          update: (params) => {
            expect(params).to.be.an('undefined');

            return Promise.resolve({ data: [] });
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');

            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'client_grants', [
              { id: 'cg1', client_id: 'client1', audience: 'audience1' },
              { id: 'cg2', client_id: 'client2', audience: 'audience2' },
            ]),
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client_delete', client_id: 'client1', audience: 'audience1' },
              { name: 'client_update', client_id: 'client2', audience: 'audience2' },
              { name: 'client_create', client_id: 'client3', audience: 'audience3' },
            ]),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const assets = {
        clientGrants: [
          {
            name: 'newClientGrant',
            client_id: 'client_create',
            audience: 'audience3',
          },
        ],
        exclude: { clients: ['client_delete', 'client_update', 'client_create'] },
      };

      await stageFn.apply(handler, [assets]);
    });
  });
  it('should not delete client grants of excluded clients with multiple instances', async () => {
    config.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    const auth0 = {
      clientGrants: {
        create: (params) => {
          expect(params).to.be.an('undefined');

          return Promise.resolve({ data: [] });
        },
        update: (params) => {
          expect(params).to.be.an('undefined');

          return Promise.resolve({ data: [] });
        },
        delete: function (params) {
          (() => expect(this).to.not.be.undefined)();
          expect(params).to.be.an('undefined');

          return Promise.resolve({ data: [] });
        },
        getAll: (params) =>
          mockPagedData(params, 'client_grants', [
            {
              client_id: '123',
              audience: 'a',
              id: '1',
            },
            {
              client_id: '123',
              audience: 'a',
              id: '2',
            },
            {
              client_id: '123',
              audience: 'a',
              id: '3',
            },
            {
              client_id: '456',
              audience: 'a',
              id: '4',
            },
            {
              client_id: '456',
              audience: 'a',
              id: '5',
            },
          ]),
      },
      clients: {
        getAll: (params) =>
          mockPagedData(params, 'clients', [
            {
              name: 'abc',
              client_id: 'abc',
            },
            {
              name: 'foo_client',
              client_id: '123',
            },
            {
              name: 'foo_client',
              client_id: '456',
            },
          ]),
      },
      pool,
    };

    const handler = new clientGrants.default({ client: pageClient(auth0), config });
    const stageFn = Object.getPrototypeOf(handler).processChanges;

    const assets = {
      clients: [
        {
          name: 'foo_client',
        },
        {
          name: 'foo_client',
        },
      ],
      clientGrants: [
        {
          client_id: 'foo_client',
          audience: 'https://example.com',
        },
        {
          client_id: 'foo_client',
          audience: 'https://example.com',
        },
        {
          client_id: 'foo_client',
          audience: 'https://example.com',
        },
        {
          client_id: 'foo_client',
          audience: 'https://example.com',
        },
        {
          client_id: 'foo_client',
          audience: 'https://example.com',
        },
      ],
      exclude: { clients: ['foo_client'] },
    };

    await stageFn.apply(handler, [assets]);
  });

  describe('#clientGrants dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return create changes for new clientGrants', async () => {
      const auth0 = {
        clientGrants: {
          getAll: (params) => mockPagedData(params, 'client_grants', []),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clientGrants: [
          {
            name: 'Client Grant 1',
            client_id: 'client1',
            audience: 'https://api1.example.com',
            scope: ['read:data'],
          },
          {
            name: 'Client Grant 2',
            client_id: 'client2',
            audience: 'https://api2.example.com',
            scope: ['write:data'],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(2);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return update changes for existing clientGrants with differences', async () => {
      const existingGrants = [
        {
          id: 'cg1',
          name: 'Client Grant 1',
          client_id: 'client1',
          audience: 'https://api1.example.com',
          scope: ['read:data'],
        },
        {
          id: 'cg2',
          name: 'Client Grant 2',
          client_id: 'client2',
          audience: 'https://api2.example.com',
          scope: ['read:data'],
        },
      ];

      const auth0 = {
        clientGrants: {
          getAll: (params) => mockPagedData(params, 'client_grants', existingGrants),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clientGrants: [
          {
            name: 'Client Grant 1',
            client_id: 'client1',
            audience: 'https://api1.example.com',
            scope: ['read:data', 'write:data'],
          },
          {
            name: 'Client Grant 2',
            client_id: 'client2',
            audience: 'https://api2.example.com',
            scope: ['write:data'],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(2);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for clientGrants not in assets', async () => {
      const existingGrants = [
        {
          id: 'cg1',
          name: 'Client Grant 1',
          client_id: 'client1',
          audience: 'https://api1.example.com',
          scope: ['read:data'],
        },
        {
          id: 'cg2',
          name: 'Client Grant 2',
          client_id: 'client2',
          audience: 'https://api2.example.com',
          scope: ['read:data'],
        },
        {
          id: 'cg3',
          name: 'Client Grant 3',
          client_id: 'client3',
          audience: 'https://api3.example.com',
          scope: ['read:data'],
        },
      ];

      const auth0 = {
        clientGrants: {
          getAll: (params) => mockPagedData(params, 'client_grants', existingGrants),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clientGrants: [
          {
            name: 'Client Grant 1',
            client_id: 'client1',
            audience: 'https://api1.example.com',
            scope: ['read:data'],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(2);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when clientGrants are identical', async () => {
      const existingGrants = [
        {
          id: 'cg1',
          name: 'Client Grant 1',
          client_id: 'client1',
          audience: 'https://api1.example.com',
          scope: ['read:data'],
        },
        {
          id: 'cg2',
          name: 'Client Grant 2',
          client_id: 'client2',
          audience: 'https://api2.example.com',
          scope: ['write:data'],
        },
      ];

      const auth0 = {
        clientGrants: {
          getAll: (params) => mockPagedData(params, 'client_grants', existingGrants),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clientGrants: [
          {
            name: 'Client Grant 1',
            client_id: 'client1',
            audience: 'https://api1.example.com',
            scope: ['read:data'],
          },
          {
            name: 'Client Grant 2',
            client_id: 'client2',
            audience: 'https://api2.example.com',
            scope: ['write:data'],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle mixed create, update, and delete operations', async () => {
      const existingGrants = [
        {
          id: 'cg1',
          name: 'Client Grant 1',
          client_id: 'client1',
          audience: 'https://api1.example.com',
          scope: ['read:data'],
        },
        {
          id: 'cg2',
          name: 'Client Grant 2',
          client_id: 'client2',
          audience: 'https://api2.example.com',
          scope: ['read:data'],
        },
      ];

      const auth0 = {
        clientGrants: {
          getAll: (params) => mockPagedData(params, 'client_grants', existingGrants),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clientGrants: [
          // Update: same client_id + audience, different scope
          {
            name: 'Client Grant 1',
            client_id: 'client1',
            audience: 'https://api1.example.com',
            scope: ['read:data', 'write:data'],
          },
          // Create: new client_id + audience combination
          {
            name: 'Client Grant 3',
            client_id: 'client3',
            audience: 'https://api3.example.com',
            scope: ['admin:all'],
          },
          // client2 + api2 will be deleted (not in assets)
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      // For mixed operations, just verify we get some changes of each type
      expect(changes.create.length).to.be.greaterThan(0);
      expect(changes.update.length).to.be.greaterThan(0);
      expect(changes.del.length).to.be.greaterThan(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const auth0 = {
        clientGrants: {
          getAll: (params) => mockPagedData(params, 'client_grants', []),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clientGrants.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {}; // No clientGrants property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
