/* eslint-disable camelcase */
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
    enforce_cascade_revocation: true,
    enforce_device_binding: 'ip',
    allowed_authentication_methods: ['cookie', 'query'],
    allow_refresh_token: true,
    enforce_online_refresh_tokens: true,
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
              enforce_cascade_revocation: true,
              enforce_device_binding: 'ip',
              allowed_authentication_methods: ['cookie', 'query'],
              allow_refresh_token: true,
              enforce_online_refresh_tokens: true,
            });
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
        pool,
      };
      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [resourceServerClient] }]);
      expect(wasCreateCalled).to.be.equal(true);
    });

    it('should create client with express_configuration and map names to IDs', async () => {
      let wasCreateCalled = false;
      const clientWithExpressConfig = {
        name: 'Client With Express Config',
        app_type: 'regular_web',
        express_configuration: {
          user_attribute_profile_id: 'My User Attribute Profile',
          connection_profile_id: 'My Connection Profile',
          okta_oin_client_id: 'My OIN Client',
        },
      };

      const auth0 = {
        clients: {
          create: function (data) {
            wasCreateCalled = true;
            expect(data).to.be.an('object');
            expect(data.name).to.equal('Client With Express Config');
            expect(data.express_configuration).to.deep.equal({
              user_attribute_profile_id: 'uap_123',
              connection_profile_id: 'cp_123',
              okta_oin_client_id: 'client_123',
            });
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData(params, 'clients', [{ client_id: 'client_123', name: 'My OIN Client' }]),
        },
        connectionProfiles: {
          list: (params) =>
            mockPagedData(params, 'connectionProfiles', [
              { id: 'cp_123', name: 'My Connection Profile' },
            ]),
        },
        userAttributeProfiles: {
          list: (params) =>
            mockPagedData(params, 'userAttributeProfiles', [
              { id: 'uap_123', name: 'My User Attribute Profile' },
            ]),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [clientWithExpressConfig] }]);
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
        pool,
      };
      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [clientWithSkipConfirmation] }]);
      expect(wasCreateCalled).to.be.equal(true);
    });

    it('should ignore third-party clients if AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS is true', async () => {
      let wasCreateCalled = false;
      const thirdPartyClient = {
        name: 'Third-Party Client',
        is_first_party: false,
      };

      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            wasCreateCalled = true;
            expect(data).to.be.an('object');
            expect(data.name).to.equal('Third-Party Client');
            expect(data.is_first_party).to.equal(false);
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
        pool,
      };

      const testConfig = function (key) {
        return testConfig.data && testConfig.data[key];
      };
      testConfig.data = {
        AUTH0_CLIENT_ID: 'client_id',
        AUTH0_ALLOW_DELETE: true,
        AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS: true,
      };

      const handler = new clients.default({
        client: pageClient(auth0),
        config: testConfig,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [thirdPartyClient] }]);
      expect(wasCreateCalled).to.be.equal(false);
    });

    it('should include third-party clients if AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS is false', async () => {
      let wasCreateCalled = false;
      const thirdPartyClient = {
        name: 'Third-Party Client',
        is_first_party: false,
      };

      const auth0 = {
        clients: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            wasCreateCalled = true;
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const testConfig = function (key) {
        return testConfig.data && testConfig.data[key];
      };
      testConfig.data = {
        AUTH0_CLIENT_ID: 'client_id',
        AUTH0_ALLOW_DELETE: true,
        AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS: false,
      };

      const handler = new clients.default({
        client: pageClient(auth0),
        config: testConfig,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ clients: [thirdPartyClient] }]);
      expect(wasCreateCalled).to.be.equal(true);
    });

    it('should get clients with is_first_party when AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS is enabled', async () => {
      const listParams = [];
      const auth0 = {
        clients: {
          list: (params) => {
            listParams.push(params);
            return mockPagedData(params, 'clients', [
              { name: 'first party client', client_id: 'first-party-client-id' },
            ]);
          },
        },
        pool,
      };

      const testConfig = function (key) {
        return testConfig.data && testConfig.data[key];
      };
      testConfig.data = {
        AUTH0_CLIENT_ID: 'client_id',
        AUTH0_ALLOW_DELETE: true,
        AUTH0_EXCLUDE_THIRD_PARTY_CLIENTS: true,
      };

      const handler = new clients.default({ client: pageClient(auth0), config: testConfig });
      await handler.getType();

      expect(listParams.length).to.be.greaterThan(0);
      const firstCallParams = listParams[0];
      expect(firstCallParams).to.be.an('object');
      expect(firstCallParams.is_first_party).to.equal(true);
      expect(firstCallParams.is_global).to.equal(false);
    });

    it('should migrate deprecated cross_origin_auth to cross_origin_authentication on export', async () => {
      const auth0 = {
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [
              {
                client_id: 'client1',
                name: 'deprecatedOnlyClient',
                app_type: 'spa',
                cross_origin_auth: true,
              },
              {
                client_id: 'client2',
                name: 'bothFieldsClient',
                app_type: 'spa',
                cross_origin_auth: false,
                cross_origin_authentication: true,
              },
              {
                client_id: 'client3',
                name: 'newOnlyClient',
                app_type: 'spa',
                cross_origin_authentication: false,
              },
            ]),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      expect(data).to.have.lengthOf(3);

      const deprecatedOnlyClient = data.find((c) => c.name === 'deprecatedOnlyClient');
      expect(deprecatedOnlyClient).to.not.have.property('cross_origin_auth');
      expect(deprecatedOnlyClient.cross_origin_authentication).to.equal(true);

      const bothFieldsClient = data.find((c) => c.name === 'bothFieldsClient');
      expect(bothFieldsClient).to.not.have.property('cross_origin_auth');
      expect(bothFieldsClient.cross_origin_authentication).to.equal(true);

      const newOnlyClient = data.find((c) => c.name === 'newOnlyClient');
      expect(newOnlyClient).to.not.have.property('cross_origin_auth');
      expect(newOnlyClient.cross_origin_authentication).to.equal(false);
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
              enforce_cascade_revocation: false,
              enforce_device_binding: 'asn',
              allowed_authentication_methods: ['query'],
              allow_refresh_token: false,
              enforce_online_refresh_tokens: false,
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
                enforce_cascade_revocation: false,
                enforce_device_binding: 'asn',
                allowed_authentication_methods: ['query'],
                allow_refresh_token: false,
                enforce_online_refresh_tokens: false,
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
            expect(params).to.be.a('string');
            expect(params).to.equal('client1');
            return Promise.resolve({ data: [] });
          },
          list: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'existingClient' },
              { client_id: 'client_id', name: 'deploy client' },
            ]),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
            expect(params).to.be.a('string');
            expect(params).to.equal('client1');
            removed = true;
            return Promise.resolve({ data: [] });
          },
          list: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'existingClient' },
              { client_id: 'client_id', name: 'deploy client' },
            ]),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
            expect(data).to.be.a('string');
            expect(data).to.equal('client-2');
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
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

    it('should migrate deprecated cross_origin_auth to cross_origin_authentication on create', async () => {
      const createdClients = [];
      const auth0 = {
        clients: {
          create: function (data) {
            createdClients.push(data);
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'clients', []),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          clients: [
            {
              name: 'deprecatedOnlyClient',
              app_type: 'spa',
              cross_origin_auth: true,
            },
            {
              name: 'bothFieldsClient',
              app_type: 'spa',
              cross_origin_auth: false,
              cross_origin_authentication: true,
            },
            {
              name: 'newOnlyClient',
              app_type: 'spa',
              cross_origin_authentication: false,
            },
          ],
        },
      ]);

      expect(createdClients).to.have.lengthOf(3);

      const deprecatedOnlyClient = createdClients.find((c) => c.name === 'deprecatedOnlyClient');
      expect(deprecatedOnlyClient).to.not.have.property('cross_origin_auth');
      expect(deprecatedOnlyClient.cross_origin_authentication).to.equal(true);

      const bothFieldsClient = createdClients.find((c) => c.name === 'bothFieldsClient');
      expect(bothFieldsClient).to.not.have.property('cross_origin_auth');
      expect(bothFieldsClient.cross_origin_authentication).to.equal(true);

      const newOnlyClient = createdClients.find((c) => c.name === 'newOnlyClient');
      expect(newOnlyClient).to.not.have.property('cross_origin_auth');
      expect(newOnlyClient.cross_origin_authentication).to.equal(false);
    });

    it('should migrate deprecated cross_origin_auth to cross_origin_authentication on update', async () => {
      const updatedClients = [];
      const auth0 = {
        clients: {
          create: () => Promise.resolve({ data: [] }),
          update: function (clientId, data) {
            updatedClients.push({ ...data, client_id: clientId });
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData(params, 'clients', [
              { client_id: 'client1', name: 'deprecatedOnlyClient' },
              { client_id: 'client2', name: 'bothFieldsClient' },
              { client_id: 'client3', name: 'newOnlyClient' },
            ]),
        },
        connectionProfiles: { list: (params) => mockPagedData(params, 'connectionProfiles', []) },
        userAttributeProfiles: {
          list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
        pool,
      };

      const handler = new clients.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          clients: [
            {
              name: 'deprecatedOnlyClient',
              app_type: 'spa',
              cross_origin_auth: true,
            },
            {
              name: 'bothFieldsClient',
              app_type: 'spa',
              cross_origin_auth: false,
              cross_origin_authentication: true,
            },
            {
              name: 'newOnlyClient',
              app_type: 'spa',
              cross_origin_authentication: false,
            },
          ],
        },
      ]);

      expect(updatedClients).to.have.lengthOf(3);

      const deprecatedOnlyClient = updatedClients.find((c) => c.client_id === 'client1');
      expect(deprecatedOnlyClient).to.not.have.property('cross_origin_auth');
      expect(deprecatedOnlyClient.cross_origin_authentication).to.equal(true);

      const bothFieldsClient = updatedClients.find((c) => c.client_id === 'client2');
      expect(bothFieldsClient).to.not.have.property('cross_origin_auth');
      expect(bothFieldsClient.cross_origin_authentication).to.equal(true);

      const newOnlyClient = updatedClients.find((c) => c.client_id === 'client3');
      expect(newOnlyClient).to.not.have.property('cross_origin_auth');
      expect(newOnlyClient.cross_origin_authentication).to.equal(false);
    });
  });
});
