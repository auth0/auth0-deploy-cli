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
  use_for_organization_discovery: true,
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
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [])),
          connections: {
            create: (org, connection) => {
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
            return Promise.resolve(data);
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () => mockPagedData({}, 'connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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

    it('should allow valid third_party_client_access property in organization', async () => {
      for (const value of ['allow', 'block']) {
        const orgWithTpa = {
          name: `org-tpa-${value}`,
          third_party_client_access: value,
        };
        let wasCreateCalled = false;
        const auth0 = {
          organizations: {
            create: function (data) {
              wasCreateCalled = true;
              expect(data.third_party_client_access).to.equal(value);
              data.id = 'fake';
              return Promise.resolve(data);
            },
            update: () => Promise.resolve({ data: [] }),
            delete: () => Promise.resolve({ data: [] }),
            list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
            connections: {
              list: () => mockPagedData({}, 'connections', []),
            },
            clientGrants: {
              list: () => mockPagedData({}, 'client_grants', []),
            },
            discoveryDomains: {
              list: () => mockPagedData({}, 'discovery_domains', []),
            },
            clients: {
              list: () => ({ data: [], hasNextPage: () => false }),
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
        await stageFn.apply(handler, [{ organizations: [orgWithTpa] }]);
        // eslint-disable-next-line no-unused-expressions
        expect(wasCreateCalled).to.be.true;
      }
    });

    it('should get organizations', async () => {
      const auth0 = {
        organizations: {
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () => mockPagedData({}, 'connections', [sampleEnabledConnection]),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', sampleOrgClientGrants),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', [sampleDiscoveryDomain]),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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

    it('should handle multi-page pagination for enabled connections', async () => {
      // Simulate 3 pages of enabled connections
      const connectionsPage1 = [
        { connection_id: 'con_1', connection: { name: 'conn1' } },
        { connection_id: 'con_2', connection: { name: 'conn2' } },
      ];
      const connectionsPage2 = [{ connection_id: 'con_3', connection: { name: 'conn3' } }];
      const connectionsPage3 = [
        { connection_id: 'con_4', connection: { name: 'conn4' } },
        { connection_id: 'con_5', connection: { name: 'conn5' } },
      ];

      const auth0 = {
        organizations: {
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () =>
              mockPagedData({}, 'connections', connectionsPage1, [
                connectionsPage2,
                connectionsPage3,
              ]),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      // Should include connections from ALL 3 pages
      expect(data[0].connections).to.have.length(5);
      expect(data[0].connections.map((c) => c.connection_id)).to.deep.equal([
        'con_1',
        'con_2',
        'con_3',
        'con_4',
        'con_5',
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
          connections: {
            list: () => mockPagedData({}, 'connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
          connections: {
            list: () => mockPagedData({}, 'connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
          connections: {
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
            create: (orgId, data) => {
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
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
          connections: {
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
            create: (orgId, data) => {
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
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
          connections: {
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
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
          connections: {
            list: () => mockPagedData({}, 'connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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

    it('should retry an enabled connection create when a 429 rate-limit error occurs', async () => {
      // Config with a tiny retry delay so the exponential backoff resolves fast in tests.
      const retryConfig = function (key) {
        return retryConfig.data && retryConfig.data[key];
      };
      retryConfig.data = {
        AUTH0_ALLOW_DELETE: true,
        AUTH0_RETRY_INITIAL_DELAY_MS: 1,
        AUTH0_RETRY_MAX_DELAY_MS: 5,
      };

      let createCallCount = 0;

      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: (id, data) => Promise.resolve(data),
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
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
            create: (orgId, data) => {
              createCallCount += 1;
              // Fail the first attempt with a 429, then succeed on the retry.
              if (createCallCount === 1) {
                const err = new Error('Too Many Requests');
                err.statusCode = 429;
                return Promise.reject(err);
              }
              expect(orgId).to.equal('123');
              expect(data.connection_id).to.equal('con_123');
              return Promise.resolve(data);
            },
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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

      const handler = new organizations.default({ client: pageClient(auth0), config: retryConfig });
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

      // The first call hit a 429 and the wrapper retried, so create is called twice.
      expect(createCallCount).to.equal(2);
    });

    it('should delete organizations', async () => {
      const auth0 = {
        organizations: {
          create: () => {
            throw new Error('create should not be called when deleting organizations');
          },
          update: () => Promise.resolve([]),
          delete: (orgId) => {
            expect(orgId).to.equal(sampleOrg.id);
            return Promise.resolve();
          },
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () => mockPagedData({}, 'connections', []),
          },
          clientGrants: {
            list: () => mockPagedData({}, 'client_grants', []),
          },
          discoveryDomains: {
            list: () => mockPagedData({}, 'discovery_domains', []),
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
      await stageFn.apply(handler, [{ organizations: [] }]);
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
            return Promise.resolve(data);
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
              expect(domain.use_for_organization_discovery).to.equal(true);
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
              discovery_domains: [
                {
                  domain: 'login.acme.com',
                  status: 'pending',
                  use_for_organization_discovery: true,
                },
              ],
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
          connections: {
            list: () => mockPagedData({}, 'connections', []),
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
              expect(body.use_for_organization_discovery).to.equal(false);
              return Promise.resolve({
                data: {
                  ...sampleDiscoveryDomain,
                  status: 'verified',
                  use_for_organization_discovery: false,
                },
              });
            },
            create: (orgId, domain) => {
              expect(orgId).to.equal('123');
              expect(domain.domain).to.equal('auth.acme.com');
              expect(domain.use_for_organization_discovery).to.equal(true);
              return Promise.resolve({ data: { ...domain, id: 'dd_new' } });
            },
            delete: (orgId, discoveryDomainId) => {
              expect(orgId).to.equal('123');
              expect(discoveryDomainId).to.equal('dd_123');
              return Promise.resolve({ data: {} });
            },
          },
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
                {
                  domain: 'login.acme.com',
                  status: 'verified',
                  use_for_organization_discovery: false,
                },
                {
                  domain: 'auth.acme.com',
                  status: 'pending',
                  use_for_organization_discovery: true,
                },
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
          connections: {
            list: () => mockPagedData({}, 'connections', []),
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
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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
          connections: {
            list: () => mockPagedData({}, 'connections', []),
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
          clients: {
            list: () => ({ data: [], hasNextPage: () => false }),
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

    it('REPRO: creating 3 orgs with discovery_domains deadlocks the pool', async function () {
      this.timeout(5000); // test FAILS with timeout = deadlock reproduced

      const createdDomains = [];

      const auth0 = {
        organizations: {
          create: (data) => {
            data.id = `org_${data.name}`;
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'organizations', []),
          enabledConnections: {
            add: () => Promise.resolve(),
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clientGrants: {
            create: () => Promise.resolve(),
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          discoveryDomains: {
            create: (_orgId, domain) => {
              createdDomains.push(domain.domain);
              return Promise.resolve({ data: { id: `dd_${domain.domain}`, ...domain } });
            },
            list: () => ({ data: [], hasNextPage: () => false }),
          },
        },
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', []),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: ['a', 'b', 'c'].map((x) => ({
            name: `org-${x}`,
            display_name: `Org ${x}`,
            client_grants: [],
            connections: [],
            discovery_domains: [
              { domain: `${x}test.io`, status: 'pending', use_for_organization_discovery: false },
            ],
          })),
        },
      ]);

      expect(createdDomains).to.have.lengthOf(3);
    });

    it('should export org-client associations with client name instead of ID', async () => {
      const sampleOrgClientFromApi = {
        client_id: 'abc_123',
        use_for_member_access: true,
        client: {
          name: 'test client',
          app_type: 'regular_web',
          is_first_party: true,
          grant_types: [],
          organization_usage: 'allow',
        },
      };

      const auth0 = {
        organizations: {
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clientGrants: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          discoveryDomains: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clients: {
            list: () => ({ data: [sampleOrgClientFromApi], hasNextPage: () => false }),
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      expect(data[0].clients).to.deep.equal([
        { client_id: 'test client', use_for_member_access: true },
      ]);
    });

    it('should create organization with org-client associations', async () => {
      let createdClients = null;

      const auth0 = {
        organizations: {
          create: (data) => {
            data.id = 'fake';
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [])),
          connections: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clientGrants: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clients: {
            create: (orgId, body) => {
              expect(orgId).to.equal('fake');
              createdClients = body.clients;
              return Promise.resolve(body.clients);
            },
            list: () => ({ data: [], hasNextPage: () => false }),
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
              clients: [{ client_id: 'test client', use_for_member_access: true }],
            },
          ],
        },
      ]);

      expect(createdClients).to.deep.equal([{ client_id: 'abc_123', use_for_member_access: true }]);
    });

    it('should add, update, and remove org-client associations on update', async () => {
      const existingOrgClientFromApi = {
        client_id: 'xyz_123',
        use_for_member_access: false,
        client: {
          name: 'deploy client',
          app_type: 'regular_web',
          is_first_party: true,
          grant_types: [],
          organization_usage: 'allow',
        },
      };

      let addedClients = null;
      let removedClientIds = null;
      let updatedClientId = null;
      let updatedBody = null;

      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clientGrants: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          discoveryDomains: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clients: {
            list: () => ({ data: [existingOrgClientFromApi], hasNextPage: () => false }),
            create: (orgId, body) => {
              addedClients = body.clients;
              return Promise.resolve(body.clients);
            },
            delete: (orgId, body) => {
              removedClientIds = body.clients;
              return Promise.resolve();
            },
            update: (orgId, clientId, body) => {
              updatedClientId = clientId;
              updatedBody = body;
              return Promise.resolve({});
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
              // remove 'deploy client', add 'test client', update deploy client's use_for_member_access
              clients: [
                { client_id: 'test client', use_for_member_access: true },
                { client_id: 'deploy client', use_for_member_access: true },
              ],
            },
          ],
        },
      ]);

      // 'test client' is new → added
      expect(addedClients).to.deep.equal([{ client_id: 'abc_123', use_for_member_access: true }]);
      // 'deploy client' use_for_member_access changed false → true → updated
      expect(updatedClientId).to.equal('xyz_123');
      expect(updatedBody).to.deep.equal({ use_for_member_access: true });
      // nothing removed
      expect(removedClientIds).to.be.null;
    });

    it('should remove org-client associations when not in config', async () => {
      const existingOrgClientFromApi = {
        client_id: 'abc_123',
        use_for_member_access: true,
        client: {
          name: 'test client',
          app_type: 'regular_web',
          is_first_party: true,
          grant_types: [],
          organization_usage: 'allow',
        },
      };

      let removedClientIds = null;

      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clientGrants: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          discoveryDomains: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clients: {
            list: () => ({ data: [existingOrgClientFromApi], hasNextPage: () => false }),
            delete: (orgId, body) => {
              removedClientIds = body.clients;
              return Promise.resolve();
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
          organizations: [{ id: '123', name: 'acme', display_name: 'Acme Inc', clients: [] }],
        },
      ]);

      expect(removedClientIds).to.deep.equal(['abc_123']);
    });

    it('should not remove org-client associations when AUTH0_ALLOW_DELETE is false', async () => {
      const configNoDelete = function (key) {
        return configNoDelete.data && configNoDelete.data[key];
      };
      configNoDelete.data = { AUTH0_ALLOW_DELETE: false };

      const existingOrgClientFromApi = {
        client_id: 'abc_123',
        use_for_member_access: true,
        client: {
          name: 'test client',
          app_type: 'regular_web',
          is_first_party: true,
          grant_types: [],
          organization_usage: 'allow',
        },
      };

      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          connections: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clientGrants: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          discoveryDomains: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clients: {
            list: () => ({ data: [existingOrgClientFromApi], hasNextPage: () => false }),
            delete: () => {
              throw new Error(
                'deleteOrganizationClients should not be called when AUTH0_ALLOW_DELETE is false'
              );
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

      // Should not throw — delete is skipped and a warning is emitted instead
      await stageFn.apply(handler, [
        {
          organizations: [{ id: '123', name: 'acme', display_name: 'Acme Inc', clients: [] }],
        },
      ]);
    });

    it('should gracefully handle when org-clients feature is not enabled (403)', async () => {
      const freshOrg = {
        id: '999',
        name: 'fresh-org',
        display_name: 'Fresh Org',
        client_grants: [],
      };
      const auth0 = {
        organizations: {
          list: (params) => Promise.resolve(mockPagedData(params, 'organizations', [freshOrg])),
          connections: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clientGrants: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          discoveryDomains: {
            list: () => ({ data: [], hasNextPage: () => false }),
          },
          clients: {
            list: () => {
              const err = new Error('feature_not_enabled');
              err.statusCode = 403;
              err.errorCode = 'feature_not_enabled';
              throw err;
            },
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', sampleClients),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      // clients property should not be set when feature is unavailable
      expect(data[0].clients).to.be.undefined;
    });
  });

  // ─── skip-unchanged tests ──────────────────────────────────────────────────
  // These tests verify the fix for the rate-limit bug where the CLI issued a
  // PATCH /organizations/{id} for every org on every import, even when nothing
  // had changed.  After the fix, organizations.update() must only be called
  // when top-level properties (display_name, branding, metadata, …) actually
  // differ from the remote state.  Sub-resource changes (connections, client
  // grants, discovery domains, org clients) continue to use their own diffing
  // and are unaffected.
  describe('#organizations skip-unchanged updates', () => {
    // shared minimal auth0 stub factory — callers override only what they need
    function makeAuth0({
      existingOrg = sampleOrg,
      existingConnections = [],
      onUpdate = null,
      onConnectionUpdate = null,
      onConnectionCreate = null,
      onConnectionDelete = null,
    } = {}) {
      return {
        organizations: {
          create: () => Promise.resolve([]),
          update: onUpdate || (() => Promise.resolve({})),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'organizations', [existingOrg]),
          connections: {
            list: () => ({ data: existingConnections, hasNextPage: () => false }),
            update: onConnectionUpdate || (() => Promise.resolve({})),
            create: onConnectionCreate || (() => Promise.resolve({})),
            delete: onConnectionDelete || (() => Promise.resolve({})),
          },
          clientGrants: { list: () => ({ data: [], hasNextPage: () => false }) },
          discoveryDomains: { list: () => ({ data: [], hasNextPage: () => false }) },
          clients: { list: () => ({ data: [], hasNextPage: () => false }) },
        },
        connections: { list: (params) => mockPagedData(params, 'connections', []) },
        clients: { list: (params) => mockPagedData(params, 'clients', sampleClients) },
        clientGrants: {
          list: (params) => mockPagedData(params, 'client_grants', [sampleClientGrant]),
        },
        pool,
      };
    }

    it('should not call organizations.update when no top-level fields changed', async () => {
      let updateCalled = false;

      const auth0 = makeAuth0({
        onUpdate: () => {
          updateCalled = true;
          return Promise.resolve({});
        },
      });

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      // Desired state exactly matches sampleOrg (id, name, display_name, client_grants)
      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: sampleOrg.display_name,
              connections: [],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(updateCalled).to.equal(false);
    });

    it('should not increment handler.updated when org is unchanged', async () => {
      const auth0 = makeAuth0();
      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: sampleOrg.display_name,
              connections: [],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(handler.updated).to.equal(0);
    });

    it('should call organizations.update when display_name changes', async () => {
      let updatedId = null;
      let updatedBody = null;

      const auth0 = makeAuth0({
        onUpdate: (id, body) => {
          updatedId = id;
          updatedBody = body;
          return Promise.resolve({});
        },
      });

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: 'Acme Updated', // changed
              connections: [],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(updatedId).to.equal(sampleOrg.id);
      expect(updatedBody.display_name).to.equal('Acme Updated');
    });

    it('should increment handler.updated when display_name changes', async () => {
      const auth0 = makeAuth0({
        onUpdate: () => Promise.resolve({}),
      });

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: 'Acme Updated',
              connections: [],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(handler.updated).to.equal(1);
    });

    it('should call organizations.update when a nested branding field changes', async () => {
      let updatedId = null;

      const existingOrgWithBranding = {
        ...sampleOrg,
        branding: { colors: { primary: '#ffffff', page_background: '#000000' } },
      };

      const auth0 = makeAuth0({
        existingOrg: existingOrgWithBranding,
        onUpdate: (id) => {
          updatedId = id;
          return Promise.resolve({});
        },
      });

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: sampleOrg.display_name,
              branding: { colors: { primary: '#ff0000', page_background: '#000000' } }, // primary changed
              connections: [],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(updatedId).to.equal(sampleOrg.id);
    });

    it('should not call organizations.update when branding is identical', async () => {
      let updateCalled = false;

      const existingOrgWithBranding = {
        ...sampleOrg,
        branding: { colors: { primary: '#ffffff', page_background: '#000000' } },
      };

      const auth0 = makeAuth0({
        existingOrg: existingOrgWithBranding,
        onUpdate: () => {
          updateCalled = true;
          return Promise.resolve({});
        },
      });

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: sampleOrg.display_name,
              branding: { colors: { primary: '#ffffff', page_background: '#000000' } }, // identical
              connections: [],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(updateCalled).to.equal(false);
    });

    it('should only update the changed org when multiple orgs exist and one changes', async () => {
      const org2 = { id: '456', name: 'contoso', display_name: 'Contoso', client_grants: [] };
      const updatedIds = [];

      const auth0 = {
        organizations: {
          create: () => Promise.resolve([]),
          update: (id) => {
            updatedIds.push(id);
            return Promise.resolve({});
          },
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'organizations', [sampleOrg, org2]),
          connections: {
            list: () => ({ data: [], hasNextPage: () => false }),
            update: () => Promise.resolve({}),
            create: () => Promise.resolve({}),
            delete: () => Promise.resolve({}),
          },
          clientGrants: { list: () => ({ data: [], hasNextPage: () => false }) },
          discoveryDomains: { list: () => ({ data: [], hasNextPage: () => false }) },
          clients: { list: () => ({ data: [], hasNextPage: () => false }) },
        },
        connections: { list: (params) => mockPagedData(params, 'connections', []) },
        clients: { list: (params) => mockPagedData(params, 'clients', sampleClients) },
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
            // acme: display_name changed
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: 'Acme Updated',
              connections: [],
              client_grants: [],
            },
            // contoso: unchanged
            {
              id: org2.id,
              name: org2.name,
              display_name: org2.display_name,
              connections: [],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(updatedIds).to.deep.equal([sampleOrg.id]);
      expect(handler.updated).to.equal(1);
    });

    it('should not call organizations.update when only a connection setting changes, but should update the connection', async () => {
      let orgUpdateCalled = false;
      let connectionUpdateCalled = false;

      const existingConnection = {
        connection_id: 'con_123',
        assign_membership_on_login: false,
        show_as_button: false,
        is_signup_enabled: false,
        is_enabled: true,
        organization_access_level: 'none',
        connection: { name: 'Username-Password-Login', strategy: 'auth0' },
      };

      const auth0 = makeAuth0({
        existingConnections: [existingConnection],
        onUpdate: () => {
          orgUpdateCalled = true;
          return Promise.resolve({});
        },
        onConnectionUpdate: (_orgId, _connectionId, _data) => {
          connectionUpdateCalled = true;
          return Promise.resolve({});
        },
      });

      // Override connections.list on the outer client to resolve connection name → id
      auth0.connections = {
        list: (params) =>
          mockPagedData(params, 'connections', [
            { id: 'con_123', name: 'Username-Password-Login', options: {} },
          ]),
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: sampleOrg.display_name, // unchanged
              connections: [
                {
                  name: 'Username-Password-Login',
                  assign_membership_on_login: true, // changed
                  show_as_button: false,
                  is_signup_enabled: false,
                },
              ],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(orgUpdateCalled).to.equal(false);
      expect(connectionUpdateCalled).to.equal(true);
      expect(handler.updated).to.equal(1);
    });

    it('should not call any API when org and all sub-resources are identical', async () => {
      const apiCalls = [];

      const existingConnection = {
        connection_id: 'con_123',
        assign_membership_on_login: false,
        show_as_button: false,
        is_signup_enabled: false,
        is_enabled: true,
        organization_access_level: 'none',
        connection: { name: 'Username-Password-Login', strategy: 'auth0' },
      };

      const auth0 = makeAuth0({
        existingConnections: [existingConnection],
        onUpdate: () => {
          apiCalls.push('org.update');
          return Promise.resolve({});
        },
        onConnectionUpdate: () => {
          apiCalls.push('conn.update');
          return Promise.resolve({});
        },
        onConnectionCreate: () => {
          apiCalls.push('conn.create');
          return Promise.resolve({});
        },
        onConnectionDelete: () => {
          apiCalls.push('conn.delete');
          return Promise.resolve({});
        },
      });

      auth0.connections = {
        list: (params) =>
          mockPagedData(params, 'connections', [
            { id: 'con_123', name: 'Username-Password-Login', options: {} },
          ]),
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          organizations: [
            {
              id: sampleOrg.id,
              name: sampleOrg.name,
              display_name: sampleOrg.display_name,
              connections: [
                {
                  name: 'Username-Password-Login',
                  assign_membership_on_login: false, // same
                  show_as_button: false, // same
                  is_signup_enabled: false, // same
                  is_enabled: true, // same
                  organization_access_level: 'none', // same — must be explicit to avoid false diff
                },
              ],
              client_grants: [],
            },
          ],
        },
      ]);

      expect(apiCalls).to.deep.equal([]);
      expect(handler.updated).to.equal(0);
    });
  });
});
