import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const resourceServers = require('../../../../src/tools/auth0/handlers/resourceServers');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#resourceServers handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#resourceServers validate', () => {
    it('should not allow same names', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someAPI',
        },
        {
          name: 'someAPI',
        },
      ];

      try {
        await stageFn.apply(handler, [{ resourceServers: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should not allow "Auth0 Management API" name', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'Auth0 Management API',
        },
      ];

      try {
        await stageFn.apply(handler, [{ resourceServers: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include("You can not configure the 'Auth0 Management API'.");
      }
    });

    it('should pass validation', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someAPI',
        },
      ];

      await stageFn.apply(handler, [{ resourceServers: data }]);
    });
  });

  describe('#resourceServers process', () => {
    it('should create resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someAPI');
            expect(data.identifier).to.equal('https://api.example.com');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { resourceServers: [{ name: 'someAPI', identifier: 'https://api.example.com' }] },
      ]);
    });

    it('should create resource server with proof_of_possession(mtls)', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('mtlsAPI');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'mtls',
              required: true,
            });
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'mtlsAPI',
              identifier: 'https://mtls-api.example.com',
              proof_of_possession: {
                mechanism: 'mtls',
                required: true,
              },
            },
          ],
        },
      ]);
    });

    it('should create resource server with proof_of_possession(dpop)', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('dpopAPI');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'dpop',
              required: true,
            });
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'dpopAPI',
              identifier: 'https://dpop-api.example.com',
              proof_of_possession: {
                mechanism: 'dpop',
                required: true,
              },
            },
          ],
        },
      ]);
    });

    it('should create resource server with subject_type_authorization', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('advancedAPI');
            expect(data.subject_type_authorization).to.deep.equal({
              user: {
                policy: 'require_client_grant',
              },
              client: {
                policy: 'deny_all',
              },
            });
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'resource_servers', []),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'advancedAPI',
              identifier: 'https://advanced-api.example.com',
              subject_type_authorization: {
                user: {
                  policy: 'require_client_grant',
                },
                client: {
                  policy: 'deny_all',
                },
              },
            },
          ],
        },
      ]);
    });

    it('should get resource servers', async () => {
      const auth0 = {
        resourceServers: {
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              {
                name: 'Auth0 Management API',
                identifier: 'https://test.auth0.com/api/v2/',
              },
              { name: 'Company API', identifier: 'http://company.com/api' },
            ]),
        },
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([{ name: 'Company API', identifier: 'http://company.com/api' }]);
    });

    it('should update resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (params, data) {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.id).to.equal('rs1');
            expect(data.scope).to.equal('new:scope');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { resourceServers: [{ name: 'someAPI', identifier: 'some-api', scope: 'new:scope' }] },
      ]);
    });

    it('should update resource server with proof_of_possession(mtls)', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (params, data) {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.id).to.equal('rs1');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'mtls',
              required: true,
            });
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'someAPI',
              identifier: 'some-api',
              proof_of_possession: {
                mechanism: 'mtls',
                required: true,
              },
            },
          ],
        },
      ]);
    });

    it('should update resource server with proof_of_possession(dpop)', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (params, data) {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.id).to.equal('rs1');
            expect(data.proof_of_possession).to.deep.equal({
              mechanism: 'dpop',
              required: false,
            });
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'someAPI',
              identifier: 'some-api',
              proof_of_possession: {
                mechanism: 'dpop',
                required: false,
              },
            },
          ],
        },
      ]);
    });

    it('should update new resource server with same name but different identifier', async () => {
      const auth0 = {
        resourceServers: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someAPI');
            expect(data.scope).to.equal('new:scope');
            expect(data.identifier).to.equal('another-api');
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be('undefined');
            expect(data).to.be('undefined');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve([]),
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { resourceServers: [{ name: 'someAPI', identifier: 'another-api', scope: 'new:scope' }] },
      ]);
    });

    it('should update resource server with subject_type_authorization', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.id).to.equal('rs1');
            expect(data.subject_type_authorization).to.deep.equal({
              user: {
                policy: 'allow_all',
              },
              client: {
                policy: 'require_client_grant',
              },
            });
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'advancedAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          resourceServers: [
            {
              name: 'advancedAPI',
              identifier: 'some-api',
              subject_type_authorization: {
                user: {
                  policy: 'allow_all',
                },
                client: {
                  policy: 'require_client_grant',
                },
              },
            },
          ],
        },
      ]);
    });

    it('should remove resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rs1');
            return Promise.resolve({ data });
          },
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ resourceServers: [{}] }]);
    });

    it('should remove all resource servers', async () => {
      let removed = false;
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rs1');
            removed = true;
            return Promise.resolve({ data });
          },
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ resourceServers: [] }]);
      expect(removed).to.equal(true);
    });

    it('should remove resource servers is run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };

      let removed = false;
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rs1');
            removed = true;
            return Promise.resolve({ data });
          },
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ resourceServers: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not touch excluded resource servers', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          delete: (data) => {
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          getAll: (params) =>
            mockPagedData(params, 'resource_servers', [
              { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
              { id: 'rs2', identifier: 'some-other-api', name: 'someOtherAPI' },
            ]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [{ name: 'someAPI', identifier: 'some-api', scope: 'new:scope' }],
        exclude: {
          resourceServers: ['someOtherAPI', 'someAPI'],
        },
      };

      await stageFn.apply(handler, [data]);
    });

    it('should preserve client_id as readonly property during updates', async () => {
      let updateCalled = false;
      const existingResourceServer = {
        id: 'rs1',
        identifier: 'some-api',
        name: 'someAPI',
        client_id: 'linked_client_123', // This should be preserved as readonly
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: function (params, data) {
            updateCalled = true;
            expect(data.client_id).to.be.equals(undefined);
            expect(data.name).to.equal('someAPI');
            // identifier is also stripped as it's readonly
            expect(params.id).to.equal('rs1'); // ID should be in params
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'resourceServers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [
          {
            name: 'someAPI',
            identifier: 'some-api',
            client_id: 'different_client_456', // This should be ignored
          },
        ],
      };

      await stageFn.apply(handler, [data]);
      expect(updateCalled).to.be.equals(true);
    });

    it('should include client_id in resource server export when present', async () => {
      const resourceServerWithClient = {
        id: 'rs1',
        identifier: 'some-api',
        name: 'someAPI',
        client_id: 'linked_client_123',
      };

      const auth0 = {
        resourceServers: {
          getAll: (params) => mockPagedData(params, 'resourceServers', [resourceServerWithClient]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const result = await handler.getType();

      expect(result).to.be.an('array');
      expect(result[0]).to.have.property('client_id', 'linked_client_123');
      expect(result[0]).to.have.property('name', 'someAPI');
      expect(result[0]).to.have.property('identifier', 'some-api');
    });

    it('should sanitize system resource servers in getType for Auth0 My Account API', async () => {
      const systemResourceServer = {
        id: 'rs_system',
        identifier: 'https://api.system.com/me/',
        name: 'Auth0 My Account API',
        is_system: true,
        token_lifetime: 86400,
        scopes: [{ value: 'read:users' }], // Should be removed
        signing_alg: 'RS256', // Should be removed
        allow_offline_access: true, // Should be removed
        skip_consent_for_verifiable_first_party_clients: true,
        enforce_policies: true, // Should be removed
        token_dialect: 'access_token', // Should be removed
      };

      const auth0 = {
        resourceServers: {
          getAll: (params) => mockPagedData(params, 'resourceServers', [systemResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const result = await handler.getType();

      expect(result).to.be.an('array');
      expect(result[0]).to.deep.equal({
        id: 'rs_system',
        identifier: 'https://api.system.com/me/',
        name: 'Auth0 My Account API',
        is_system: true,
        token_lifetime: 86400,
        skip_consent_for_verifiable_first_party_clients: true,
      });
    });

    it('should update "Auth0 My Account API" without name and is_system', async () => {
      let updateCalled = false;
      const existingResourceServer = {
        id: 'rs_my_account',
        identifier: 'https://auth0.com/my-account/me/',
        name: 'Auth0 My Account API',
        is_system: true,
      };

      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve({ data: [] }),
          update: function (params, data) {
            updateCalled = true;
            expect(params.id).to.equal('rs_my_account');
            expect(data.name).to.equal(undefined);
            expect(data.is_system).to.equal(undefined);
            expect(data.token_lifetime).to.equal(54321);
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'resourceServers', [existingResourceServer]),
        },
        pool,
      };

      const handler = new resourceServers.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [
          {
            name: 'Auth0 My Account API',
            identifier: 'https://auth0.com/my-account/me/',
            token_lifetime: 54321,
          },
        ],
      };

      await stageFn.apply(handler, [data]);
      expect(updateCalled).to.equal(true);
    });
  });
});
