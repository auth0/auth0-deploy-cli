import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const clients = require('../../../../src/tools/auth0/handlers/clients');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

const someNativeClient = {
  name: 'someNativeClient',
  app_type: 'native',
  grant_types: ['authorization_code', 'implicit', 'refresh_token'],
  mobile: {
    android: {
      app_package_name: 'com.my.android.id',
    },
  },
  native_social_login: {
    google: {
      enabled: true,
    },
  },
  session_transfer: {
    can_create_session_transfer_token: true,
    enforce_device_binding: 'ip',
    allowed_authentication_methods: ['cookie', 'query'],
  },
};

describe('#clients handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#clients validate', () => {
    it('should not allow same names', async () => {
      const handler = new clients.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someClient',
        },
        {
          name: 'someClient',
        },
      ];

      try {
        await stageFn.apply(handler, [{ clients: data }]);
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
          name: 'someClient',
        },
      ];

      await stageFn.apply(handler, [{ clients: data }]);
    });
  });

  describe('#clients process', () => {
    it('should create client', async () => {
      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someClient');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [{ name: 'someClient' }] }]);
    });

    it('should create native client', async () => {
      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someNativeClient');
            expect(data.app_type).to.equal('native');
            expect(data.grant_types).to.deep.equal([
              'authorization_code',
              'implicit',
              'refresh_token',
            ]);
            expect(data.mobile).to.deep.equal({
              android: {
                app_package_name: 'com.my.android.id',
              },
            });
            expect(data.native_social_login).to.deep.equal({
              google: {
                enabled: true,
              },
            });
            expect(data.session_transfer).to.deep.equal({
              can_create_session_transfer_token: true,
              enforce_device_binding: 'ip',
              allowed_authentication_methods: ['cookie', 'query'],
            });
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [someNativeClient] }]);
    });

    it('should create client with refresh token policies', async () => {
      const clientWithRefreshTokenPolicies = {
        name: 'clientWithRefreshTokenPolicies',
        refresh_token: {
          policies: [
            {
              audience: 'https://api.example.com',
              scope: ['read:users', 'write:users'],
            },
            {
              audience: 'https://other-api.example.com',
              scope: ['read:data'],
            },
          ],
        },
      };

      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('clientWithRefreshTokenPolicies');
            expect(data.refresh_token).to.be.an('object');
            expect(data.refresh_token.policies).to.be.an('array');
            expect(data.refresh_token.policies).to.deep.equal([
              {
                audience: 'https://api.example.com',
                scope: ['read:users', 'write:users'],
              },
              {
                audience: 'https://other-api.example.com',
                scope: ['read:data'],
              },
            ]);
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [clientWithRefreshTokenPolicies] }]);
    });

    it('should allow valid token_quota property in client', async () => {
      const clientWithTokenQuota = {
        name: 'clientWithTokenQuota',
        token_quota: {
          client_credentials: {
            enforce: true,
            per_day: 1000,
            per_hour: 100,
          },
        },
      };
      let wasCreateCalled = false;
      const auth0 = {
        clients: {
          create: function (data) {
            wasCreateCalled = true;
            expect(data).to.be.an('object');
            expect(data.name).to.equal('clientWithTokenQuota');
            expect(data.token_quota).to.deep.equal({
              client_credentials: {
                enforce: true,
                per_day: 1000,
                per_hour: 100,
              },
            });
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };
      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [clientWithTokenQuota] }]);
      // eslint-disable-next-line no-unused-expressions
      expect(wasCreateCalled).to.be.true;
    });

    it('should get clients', async () => {
      const auth0 = {
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'test client', client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV' },
              { name: 'deploy client', client_id: 'client_id' },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV', name: 'test client' },
        { client_id: 'client_id', name: 'deploy client' },
      ]);
    });

    it('should update client', async () => {
      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('array');
            expect(data.length).to.equal(0);
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.client_id).to.equal('client1');
            expect(data).to.be.an('object');
            expect(data.description).to.equal('new description');
            expect(data.session_transfer).to.deep.equal({
              can_create_session_transfer_token: false,
              enforce_device_binding: 'asn',
              allowed_authentication_methods: ['query'],
            });

            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              {
                client_id: 'client1',
                name: 'someClient',
              },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          clients: [
            {
              name: 'someClient',
              description: 'new description',
              session_transfer: {
                can_create_session_transfer_token: false,
                enforce_device_binding: 'asn',
                allowed_authentication_methods: ['query'],
              },
            },
          ],
        },
      ]);
    });

    it('should delete client and create another one instead', async () => {
      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someClient');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.client_id).to.equal('client1');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'existingClient' },
              { client_id: 'client_id', name: 'deploy client' },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [{ name: 'someClient' }] }]);
    });

    it('should delete all clients', async () => {
      let removed = false;
      const auth0 = {
        clients: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.client_id).to.equal('client1');
            removed = true;
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'existingClient' },
              { client_id: 'client_id', name: 'deploy client' },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove client if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        clients: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client1', name: 'existingClient' }]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [{ name: 'newClient' }] }]);
    });

    it('should not remove, update or create client if it is excluded', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      const auth0 = {
        clients: {
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
          getAll: (params) => Promise.resolve(mockPagedData(params, 'clients', [])),
        },
        pool,
      };

      const assets = {
        clients: [{ name: 'Client 1' }, { name: 'Client 2' }],
        exclude: {
          clients: ['Client 1', 'Client 2'],
        },
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [assets]);
    });

    it('should not remove clients if run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };

      const auth0 = {
        clients: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'existingClient' },
              { client_id: 'client2', name: 'existingClient2' },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [] }]);
    });

    it('should process clients even if AUTH0_CLIENT_ID is not defined', async () => {
      let wasCreateCalled = false;
      let wasUpdateCalled = false;
      let wasDeleteCalled = false;
      const auth0 = {
        clients: {
          create: function (data) {
            wasCreateCalled = true;
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('Client 3');
            return Promise.resolve({ data });
          },
          update: function (data) {
            wasUpdateCalled = true;
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.client_id).to.equal('client-1');
            return Promise.resolve({ data });
          },
          delete: function (data) {
            wasDeleteCalled = true;
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.client_id).to.equal('client-2');
            return Promise.resolve({ data });
          },
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              {
                client_id: 'client-1',
                name: 'Client 1',
              },
              {
                client_id: 'client-2',
                name: 'Client 2',
              },
            ]),
        },
        pool,
      };

      const handler = new clients.default({
        client: pageClient(auth0),
        config: (key) =>
          ({
            // Notably omitted is AUTH0_CLIENT_ID which
            AUTH0_ACCESS_TOKEN:
              'some-fake-access-token-which-is-why-AUTH0_CLIENT_ID-does-not-exists',
            AUTH0_ALLOW_DELETE: true,
          }[key]),
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          clients: [{ name: 'Client 1' }, { name: 'Client 3' }],
        },
      ]);
      // eslint-disable-next-line no-unused-expressions
      expect(wasCreateCalled).to.be.true;
      // eslint-disable-next-line no-unused-expressions
      expect(wasUpdateCalled).to.be.true;
      // eslint-disable-next-line no-unused-expressions
      expect(wasDeleteCalled).to.be.true;
    });
  });

  describe('#clients dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return create changes for new clients', async () => {
      const auth0 = {
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clients: [
          { name: 'New Client 1', app_type: 'spa' },
          { name: 'New Client 2', app_type: 'regular_web' },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(2);
      expect(changes.create[0]).to.include({ name: 'New Client 1', app_type: 'spa' });
      expect(changes.create[1]).to.include({ name: 'New Client 2', app_type: 'regular_web' });
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return update changes for existing clients with differences', async () => {
      const auth0 = {
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'Existing Client', description: 'old description' },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clients: [{ name: 'Existing Client', description: 'new description' }],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.update[0]).to.include({
        name: 'Existing Client',
        description: 'new description',
        client_id: 'client1',
      });
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for clients not in assets', async () => {
      const auth0 = {
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'Client To Remove' },
              // Note: Not including deploy client here as it gets filtered out in real scenarios
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = { clients: [] };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(1);
      expect(changes.del[0]).to.include({ client_id: 'client1', name: 'Client To Remove' });
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when clients are identical', async () => {
      const auth0 = {
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              {
                client_id: 'client1',
                name: 'Unchanged Client',
                app_type: 'spa',
                description: 'same description',
              },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clients: [
          {
            name: 'Unchanged Client',
            app_type: 'spa',
            description: 'same description',
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
      const auth0 = {
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'Update Client', description: 'old' },
              { client_id: 'client2', name: 'Delete Client' },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        clients: [
          { name: 'Update Client', description: 'new' },
          { name: 'Create Client', app_type: 'spa' },
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
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {}; // No clients property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
