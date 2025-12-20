import { PromisePoolExecutor } from 'promise-pool-executor';
import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const organizations = require('../../../../src/tools/auth0/handlers/organizations');
const { mockPagedData } = require('../../../utils');

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleOrg = {
  id: '123',
  name: 'acme',
  display_name: 'Acme Inc',
  client_grants: [],
};

const sampleEnabledConnection = {
  connection_id: 'con_123',
  assign_membership_on_login: true,
  show_as_button: false,
  is_signup_enabled: true,
  connection: {
    name: 'Username-Password-Login',
    strategy: 'auth0',
  },
};

const sampleEnabledConnection2 = {
  connection_id: 'con_456',
  assign_membership_on_login: false,
  show_as_button: true,
  connection: {
    name: 'facebook',
    strategy: 'facebook',
  },
};

const sampleOrgClientGrants = [
  {
    client_id: 'abc_123',
  },
];

const sampleClients = [
  { name: 'test client', client_id: 'abc_123' },
  { name: 'deploy client', client_id: 'xyz_123' },
];

const sampleClientGrant = {
  audience: 'https://test.auth0.com/api/v2/',
  client_id: 'abc_123',
  id: 'cgr_0TLisL4eNHzhSR6j',
  scope: ['read:logs'],
};

const sampleDiscoveryDomain = {
  id: 'dd_123',
  domain: 'login.acme.com',
  status: 'pending',
  verification_txt: 'auth0-domain-verification=xyz',
  verification_host: '_auth0-domain-verification.login.acme.com',
};

describe('#organizations handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#organizations validate', () => {
    it('should not allow same id', async () => {
      const handler = new organizations.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          id: '123',
          name: 'Acme',
        },
        {
          id: '123',
          name: 'Contoso',
        },
      ];

      try {
        await stageFn.apply(handler, [{ organizations: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include(
          'Only one rule must be defined for the same order number in a stage.'
        );
      }
    });

    it('should not allow same names', async () => {
      const handler = new organizations.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'Acme',
        },
        {
          name: 'Acme',
        },
      ];

      try {
        await stageFn.apply(handler, [{ organizations: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new organizations.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'Acme',
        },
      ];

      await stageFn.apply(handler, [{ organizations: data }]);
    });
  });

  describe('#organizations process', () => {
    it('should return empty if no organization asset', async () => {
      const auth0 = {
        organizations: {},
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create organization', async () => {
      const auth0 = {
        organizations: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('acme');
            expect(data.display_name).to.equal('Acme');
            expect(data.connections).to.equal(undefined);
            data.id = 'fake';
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [])),
          enabledConnections: {
            add: (org, connection) => {
              expect(org).to.equal('fake');
              expect(connection).to.be.an('object');
              expect(connection.connection_id).to.equal('con_123');
              expect(connection.assign_membership_on_login).to.equal(true);
              expect(connection.show_as_button).to.equal(false);
              expect(connection.is_signup_enabled).to.equal(true);
              return Promise.resolve(connection);
            },
            list: () => ({
              data: [],
              hasNextPage: () => false,
              getNextPage: () =>
                Promise.resolve({
                  data: [],
                  hasNextPage: () => false,
                  getNextPage: () => Promise.resolve({ data: [], hasNextPage: () => false }),
                }),
            }),
          },
          clientGrants: {
            create: (orgId, clientGrant) => {
              expect(orgId).to.equal('fake');
              expect(clientGrant).to.be.an('object');
              expect(clientGrant).to.have.property('grant_id');
              return Promise.resolve({ grant_id: clientGrant.grant_id });
            },
            list: () => ({
              data: [],
              hasNextPage: () => false,
              getNextPage: () =>
                Promise.resolve({
                  data: [],
                  hasNextPage: () => false,
                  getNextPage: () => Promise.resolve({ data: [], hasNextPage: () => false }),
                }),
            }),
          },
        },
        connections: {
          list: (params) =>
            mockPagedData(params, 'connections', [
              {
                id: sampleEnabledConnection.connection_id,
                name: sampleEnabledConnection.connection.name,
                options: {},
              },
              {
                id: sampleEnabledConnection2.connection_id,
                name: sampleEnabledConnection2.connection.name,
                options: {},
              },
              { id: 'con_999', name: 'Username', options: {} },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          organizations: [
            {
              name: 'acme',
              display_name: 'Acme',
              connections: [
                {
                  name: 'Username-Password-Login',
                  assign_membership_on_login: true,
                  show_as_button: false,
                  is_signup_enabled: true,
                },
              ],
              client_grants: sampleOrgClientGrants,
            },
          ],
        },
      ]);
    });

    it('should allow valid token_quota property in organization', async () => {
      const orgWithTokenQuota = {
        name: 'orgWithTokenQuota',
        token_quota: {
          client_credentials: {
            enforce: false,
            per_day: 500,
            per_hour: 50,
          },
        },
      };
      let wasCreateCalled = false;
      const auth0 = {
        organizations: {
          create: function (data) {
            wasCreateCalled = true;
            expect(data).to.be.an('object');
            expect(data.name).to.equal('orgWithTokenQuota');
            expect(data.token_quota).to.deep.equal({
              client_credentials: {
                enforce: false,
                per_day: 500,
                per_hour: 50,
              },
            });
            data.id = 'fake';
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };
      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ organizations: [orgWithTokenQuota] }]);
      // eslint-disable-next-line no-unused-expressions
      expect(wasCreateCalled).to.be.true;
    });

    it('should get organizations', async () => {
      const auth0 = {
        organizations: {
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', [sampleEnabledConnection]),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', sampleOrgClientGrants),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', [sampleDiscoveryDomain]),
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        {
          ...sampleOrg,
          connections: [sampleEnabledConnection],
          discovery_domains: [sampleDiscoveryDomain],
        },
      ]);
    });

    it('should get all organizations', async function () {
      const organizationsPage1 = Array.from({ length: 3 }, (v, i) => ({
        id: 'org_' + i,
        name: 'acme' + i,
        display_name: 'Acme ' + i,
      }));
      const organizationsPage2 = Array.from({ length: 5 }, (v, i) => ({
        id: 'org_' + (i + 10),
        name: 'acme' + (i + 10),
        display_name: 'Acme ' + (i + 10),
      }));

      const auth0 = {
        organizations: {
          list: (params) =>
            Promise.resolve(
              mockPagedData(params, 'organizations', [...organizationsPage2, ...organizationsPage1])
            ),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.have.length(8);
    });

    it('should return an empty array for old versions of the sdk', async () => {
      const auth0 = {
        organizations: {
          list: () => {
            const error = new Error('organizations.list is not a function');
            error.statusCode = 501;
            throw error;
          },
        },
        clients: {
          list: () => {
            const error = new Error('clients.list is not a function');
            error.statusCode = 501;
            throw error;
          },
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should return an empty array for 501 status code', async () => {
      const auth0 = {
        organizations: {
          list: () => {
            const error = new Error('Feature is not yet implemented');
            error.statusCode = 501;
            throw error;
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should return an empty array for 404 status code', async () => {
      const auth0 = {
        organizations: {
          list: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        organizations: {
          list: () => {
            const error = new Error('Bad request');
            error.statusCode = 500;
            throw error;
          },
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
      }
    });

    it('should call getAll once', async () => {
      let shouldThrow = false;
      const auth0 = {
        organizations: {
          list: (params) => {
            if (!shouldThrow) {
              return mockPagedData(params, 'organizations', [sampleOrg]);
            }

            throw new Error('Unexpected');
          },
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      let data = await handler.getType();
      expect(data).to.deep.equal([sampleOrg]);

      shouldThrow = true;
      data = await handler.getType();
      expect(data).to.deep.equal([sampleOrg]);
    });

    it('should update organizations', async () => {
      const auth0 = {
        organizations: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            Promise.resolve(
              mockPagedData({ ...params, include_totals: true }, 'organizations', [sampleOrg])
            ),
          enabledConnections: {
            list: () => ({
              data: [sampleEnabledConnection, sampleEnabledConnection2],
              hasNextPage: () => false,
              getNextPage: () =>
                Promise.resolve({
                  data: [],
                  hasNextPage: () => false,
                  getNextPage: () => Promise.resolve({ data: [], hasNextPage: () => false }),
                }),
            }),
            add: (orgId, data) => {
              expect(orgId).to.equal('123');
              expect(data).to.be.an('object');
              expect(data.connection_id).to.equal('con_789');
              expect(data.assign_membership_on_login).to.equal(false);
              return Promise.resolve(data);
            },
            delete: (orgId, connectionId) => {
              expect(orgId).to.equal('123');
              expect(connectionId).to.equal(sampleEnabledConnection2.connection_id);
              return Promise.resolve(undefined);
            },
            update: (orgId, connectionId, data) => {
              if (connectionId === sampleEnabledConnection.connection_id) {
                expect(orgId).to.equal('123');
                expect(connectionId).to.equal(sampleEnabledConnection.connection_id);
                expect(data).to.be.an('object');
                expect(data.assign_membership_on_login).to.equal(false);
                expect(data.show_as_button).to.equal(true);
                expect(data.is_signup_enabled).to.equal(false);
              } else {
                expect(orgId).to.equal('123');
                expect(connectionId).to.equal(sampleEnabledConnection2.connection_id);
                expect(data).to.be.an('object');
                expect(data.assign_membership_on_login).to.equal(true);
                expect(data.show_as_button).to.equal(false);
              }
              return Promise.resolve(data);
            },
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        connections: {
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'connections', [
              {
                id: sampleEnabledConnection.connection_id,
                name: sampleEnabledConnection.connection.name,
                options: {},
              },
              {
                id: sampleEnabledConnection2.connection_id,
                name: sampleEnabledConnection2.connection.name,
                options: {},
              },
              { id: 'con_999', name: 'Username', options: {} },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: '123',
              name: 'acme',
              display_name: 'Acme 2',
              connections: [
                {
                  name: 'Username-Password-Login',
                  assign_membership_on_login: false,
                  show_as_button: true,
                  is_signup_enabled: false,
                },
                { name: 'facebook', assign_membership_on_login: true, show_as_button: false },
              ],
            },
          ],
        },
      ]);
    });

    it('should add an enabled connection to the organizations', async () => {
      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => ({
              data: [],
              hasNextPage: () => false,
              getNextPage: () =>
                Promise.resolve({
                  data: [],
                  hasNextPage: () => false,
                  getNextPage: () => Promise.resolve({ data: [], hasNextPage: () => false }),
                }),
            }),
            add: (orgId, data) => {
              expect(orgId).to.equal('123');
              expect(data).to.be.an('object');
              expect(data.connection_id).to.equal('con_123');
              expect(data.assign_membership_on_login).to.equal(false);
              expect(data.show_as_button).to.equal(false);
              expect(data.is_signup_enabled).to.equal(false);
              return Promise.resolve(data);
            },
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        connections: {
          list: (params) =>
            mockPagedData(params, 'connections', [
              {
                id: sampleEnabledConnection.connection_id,
                name: sampleEnabledConnection.connection.name,
                options: {},
              },
              {
                id: sampleEnabledConnection2.connection_id,
                name: sampleEnabledConnection2.connection.name,
                options: {},
              },
              { id: 'con_999', name: 'Username', options: {} },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: '123',
              name: 'acme',
              display_name: 'Acme 2',
              connections: [
                {
                  name: 'Username-Password-Login',
                  assign_membership_on_login: false,
                  show_as_button: false,
                  is_signup_enabled: false,
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should remove an enabled connection to the organizations', async () => {
      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => ({
              data: [sampleEnabledConnection2],
              hasNextPage: () => false,
              getNextPage: () =>
                Promise.resolve({
                  data: [],
                  hasNextPage: () => false,
                  getNextPage: () => Promise.resolve({ data: [], hasNextPage: () => false }),
                }),
            }),
            delete: (orgId, connectionId) => {
              expect(orgId).to.equal('123');
              expect(connectionId).to.equal(sampleEnabledConnection2.connection_id);
              return Promise.resolve(undefined);
            },
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        connections: {
          list: (params) =>
            mockPagedData(params, 'connections', [
              {
                id: sampleEnabledConnection.connection_id,
                name: sampleEnabledConnection.connection.name,
                options: {},
              },
              {
                id: sampleEnabledConnection2.connection_id,
                name: sampleEnabledConnection2.connection.name,
                options: {},
              },
              { id: 'con_999', name: 'Username', options: {} },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: '123',
              name: 'acme',
              display_name: 'Acme 2',
            },
          ],
        },
      ]);
    });

    it('should ignore an enabled connection if it does not exist', async () => {
      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        connections: {
          list: (params) =>
            mockPagedData(params, 'connections', [
              {
                id: sampleEnabledConnection.connection_id,
                name: sampleEnabledConnection.connection.name,
                options: {},
              },
              {
                id: sampleEnabledConnection2.connection_id,
                name: sampleEnabledConnection2.connection.name,
                options: {},
              },
              { id: 'con_999', name: 'Username', options: {} },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: '123',
              name: 'acme',
              display_name: 'Acme 2',
              connections: [{ name: 'Does not exist', assign_membership_on_login: false }],
            },
          ],
        },
      ]);
    });

    it('should delete organizations', async () => {
      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (orgId) => {
            expect(orgId).to.equal(sampleOrg.id);
            return Promise.resolve();
          },
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
        },
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };
      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ organizations: [{}] }]);
    });

    it('should create organization with discovery domains', async () => {
      const auth0 = {
        organizations: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('acme');
            expect(data.discovery_domains).to.equal(undefined);
            data.id = 'fake';
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [])),
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
            create: (orgId, domain) => {
              expect(orgId).to.equal('fake');
              expect(domain).to.be.an('object');
              expect(domain.domain).to.equal('login.acme.com');
              expect(domain.status).to.equal('pending');
              return Promise.resolve({ data: { ...domain, id: 'dd_new' } });
            },
          },
        },
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          organizations: [
            {
              name: 'acme',
              display_name: 'Acme',
              discovery_domains: [{ domain: 'login.acme.com', status: 'pending' }],
            },
          ],
        },
      ]);
    });

    it('should update organization discovery domains', async () => {
      const auth0 = {
        organizations: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('123');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', [sampleDiscoveryDomain]),
            update: (orgId, discoveryDomainId, body) => {
              expect(orgId).to.equal('123');
              expect(discoveryDomainId).to.equal('dd_123');
              expect(body.status).to.equal('verified');
              return Promise.resolve({ data: { ...sampleDiscoveryDomain, status: 'verified' } });
            },
            create: (orgId, domain) => {
              expect(orgId).to.equal('123');
              expect(domain.domain).to.equal('auth.acme.com');
              return Promise.resolve({ data: { ...domain, id: 'dd_new' } });
            },
            delete: (orgId, discoveryDomainId) => {
              expect(orgId).to.equal('123');
              expect(discoveryDomainId).to.equal('dd_123');
              return Promise.resolve({ data: {} });
            },
          },
        },
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: '123',
              name: 'acme',
              display_name: 'Acme Inc',
              discovery_domains: [
                { domain: 'login.acme.com', status: 'verified' },
                { domain: 'auth.acme.com', status: 'pending' },
              ],
            },
          ],
        },
      ]);
    });

    it('should delete organization discovery domains', async () => {
      const auth0 = {
        organizations: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('123');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () =>
              mockPagedData({}, 'discovery_domains', [
                sampleDiscoveryDomain,
                {
                  id: 'dd_456',
                  domain: 'auth.acme.com',
                  status: 'verified',
                  verification_txt: 'auth0-domain-verification=abc',
                  verification_host: '_auth0-domain-verification.auth.acme.com',
                },
              ]),
            update: (orgId, discoveryDomainId, body) => {
              expect(orgId).to.equal('123');
              expect(discoveryDomainId).to.equal('dd_123');
              return Promise.resolve({ data: { ...sampleDiscoveryDomain, ...body } });
            },
            delete: (orgId, discoveryDomainId) => {
              expect(orgId).to.equal('123');
              expect(discoveryDomainId).to.equal('dd_456');
              return Promise.resolve({ data: {} });
            },
          },
        },
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: '123',
              name: 'acme',
              display_name: 'Acme Inc',
              discovery_domains: [
                // Only keep one domain, delete the other
                { domain: 'login.acme.com', status: 'verified' },
              ],
            },
          ],
        },
      ]);
    });

    it('should handle discovery domain deletion when AUTH0_ALLOW_DELETE is false', async () => {
      const configNoDelete = function (key) {
        return configNoDelete.data && configNoDelete.data[key];
      };

      configNoDelete.data = {
        AUTH0_ALLOW_DELETE: false,
      };

      const auth0 = {
        organizations: {
          create: () => Promise.resolve({ data: [] }),
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('123');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          enabledConnections: {
            list: () => mockPagedData({}, 'enabled_connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () =>
              mockPagedData({}, 'discovery_domains', [
                sampleDiscoveryDomain,
                {
                  id: 'dd_456',
                  domain: 'auth.acme.com',
                  status: 'verified',
                  verification_txt: 'auth0-domain-verification=abc',
                  verification_host: '_auth0-domain-verification.auth.acme.com',
                },
              ]),
            update: (orgId, discoveryDomainId, body) => {
              expect(orgId).to.equal('123');
              return Promise.resolve({ data: { ...sampleDiscoveryDomain, ...body } });
            },
            delete: () => {
              throw new Error('deleteDiscoveryDomain should not be called when delete is disabled');
            },
          },
        },
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };

      const handler = new organizations.default({
        client: pageClient(auth0),
        config: configNoDelete,
      });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: '123',
              name: 'acme',
              display_name: 'Acme Inc',
              discovery_domains: [
                // Only keep one domain, other will be deleted but should warn
                { domain: 'login.acme.com', status: 'verified' },
              ],
            },
          ],
        },
      ]);
    });
  });
});
