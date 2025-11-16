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
          list: (params) => mockPagedData(params, 'clients', []),
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
          list: (params) => mockPagedData(params, 'clients', []),
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
          list: (params) => mockPagedData(params, 'clients', []),
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
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };
      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [clientWithTokenQuota] }]);
      // eslint-disable-next-line no-unused-expressions
      expect(wasCreateCalled).to.be.true;
    });

    it('should create resource server client', async () => {
      let wasCreateCalled = false;
      const resourceServerClient = {
        name: 'My Resource Server Client',
        app_type: 'resource_server',
        resource_server_identifier: 'https://api.example.com/v1',
      };

      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            wasCreateCalled = true;
            expect(data).to.be.an('object');
            expect(data.name).to.equal('My Resource Server Client');
            expect(data.app_type).to.equal('resource_server');
            expect(data.resource_server_identifier).to.equal('https://api.example.com/v1');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };
      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [resourceServerClient] }]);
      expect(wasCreateCalled).to.be.equal(true);
    });

    it('should create client with skip_non_verifiable_callback_uri_confirmation_prompt', async () => {
      let wasCreateCalled = false;
      const clientWithSkipConfirmation = {
        name: 'Client With Skip Confirmation',
        skip_non_verifiable_callback_uri_confirmation_prompt: true,
      };

      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            wasCreateCalled = true;
            expect(data).to.be.an('object');
            expect(data.name).to.equal('Client With Skip Confirmation');
            expect(data.skip_non_verifiable_callback_uri_confirmation_prompt).to.equal(true);
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };
      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [clientWithSkipConfirmation] }]);
      expect(wasCreateCalled).to.be.equal(true);
    });

    it('should get clients', async () => {
      const auth0 = {
        clients: {
          list: (params) =>
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
          update: function (clientId, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(clientId).to.be.a('string');
            expect(clientId).to.equal('client1');
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
          list: (params) =>
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

    it('should update client with skip_non_verifiable_callback_uri_confirmation_prompt', async () => {
      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('array');
            expect(data.length).to.equal(0);
            return Promise.resolve({ data });
          },
          update: function (client_id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(client_id).to.be.a('string');
            expect(client_id).to.equal('client1');
            expect(data).to.be.an('object');
            expect(data.skip_non_verifiable_callback_uri_confirmation_prompt).to.equal(false);

            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
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
              skip_non_verifiable_callback_uri_confirmation_prompt: false,
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
          list: (params) =>
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
          list: (params) =>
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
          list: (params) =>
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
          list: (params) => Promise.resolve(mockPagedData(params, 'clients', [])),
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
          list: (params) =>
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
          update: function (clientId, data) {
            wasUpdateCalled = true;
            (() => expect(this).to.not.be.undefined)();
            expect(clientId).to.be.a('string');
            expect(clientId).to.equal('client-1');
            expect(data).to.be.an('object');
            return Promise.resolve({ data });
          },
          delete: function (data) {
            wasDeleteCalled = true;
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.client_id).to.equal('client-2');
            return Promise.resolve({ data });
          },
          list: (params) =>
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

    it('should create client with organization properties', async () => {
      const clientWithOrganization = {
        name: 'My Client',
        oidc_conformant: true,
        organization_usage: 'require',
        organization_require_behavior: 'pre_login_prompt',
        organization_discovery_methods: ['email'],
        async_approval_notification_channels: ['guardian-push'],
      };

      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('My Client');
            expect(data.oidc_conformant).to.equal(true);
            expect(data.organization_usage).to.equal('require');
            expect(data.organization_require_behavior).to.equal('pre_login_prompt');
            expect(data.organization_discovery_methods).to.deep.equal(['email']);
            expect(data.async_approval_notification_channels).to.deep.equal(['guardian-push']);
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [clientWithOrganization] }]);
    });

    it('should handle organization_discovery_methods with multiple values', async () => {
      const clientWithMultipleMethods = {
        name: 'My Client',
        organization_usage: 'require',
        organization_require_behavior: 'pre_login_prompt',
        organization_discovery_methods: ['organization_name', 'email'],
        async_approval_notification_channels: ['email', 'guardian-push'],
      };

      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data.organization_discovery_methods).to.deep.equal([
              'organization_name',
              'email',
            ]);
            expect(data.async_approval_notification_channels).to.deep.equal([
              'email',
              'guardian-push',
            ]);
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ clients: [clientWithMultipleMethods] }]);
    });

    it('should update client organization_usage while preserving organization_require_behavior', async () => {
      const auth0 = {
        clients: {
          create: () => Promise.resolve({ data: [] }),
          update: function (client_id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(client_id).to.equal('client1');
            expect(data.organization_usage).to.equal('allow');
            // organization_require_behavior should be preserved if not updated
            expect(data).to.not.have.property('organization_require_behavior');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData(params, 'clients', [
              {
                client_id: 'client1',
                name: 'My Client',
                organization_usage: 'require',
                organization_require_behavior: 'pre_login_prompt',
                organization_discovery_methods: ['email'],
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
              name: 'My Client',
              organization_usage: 'allow',
            },
          ],
        },
      ]);
    });

    it('should update client and remove organization_discovery_methods by setting to null', async () => {
      const auth0 = {
        clients: {
          create: () => Promise.resolve({ data: [] }),
          update: function (client_id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(client_id).to.equal('client1');
            expect(data.organization_require_behavior).to.equal('post_login_prompt');
            // eslint-disable-next-line no-unused-expressions
            expect(data.organization_discovery_methods).to.be.null;
            // eslint-disable-next-line no-unused-expressions
            expect(data.async_approval_notification_channels).to.be.null;
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData(params, 'clients', [
              {
                client_id: 'client1',
                name: 'My Client',
                organization_usage: 'allow',
                organization_require_behavior: 'pre_login_prompt',
                organization_discovery_methods: ['email'],
                async_approval_notification_channels: ['guardian-push', 'email'],
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
              name: 'My Client',
              organization_require_behavior: 'post_login_prompt',
              organization_discovery_methods: null,
              async_approval_notification_channels: null,
            },
          ],
        },
      ]);
    });
  });
});
