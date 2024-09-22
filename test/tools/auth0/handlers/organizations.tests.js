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
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => Promise.resolve(mockPagedData(params, 'organizations', [])),
          addEnabledConnection: (org, connection) => {
            expect(org.id).to.equal('fake');
            expect(connection).to.be.an('object');
            expect(connection.connection_id).to.equal('con_123');
            expect(connection.assign_membership_on_login).to.equal(true);
            expect(connection.show_as_button).to.equal(false);
            expect(connection.is_signup_enabled).to.equal(true);
            return Promise.resolve({ data: connection });
          },
        },
        connections: {
          getAll: (params) =>
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
                  is_signup_enabled: true
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should get organizations', async () => {
      const auth0 = {
        organizations: {
          getAll: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          getEnabledConnections: () => ({ data: [sampleEnabledConnection] }),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([{ ...sampleOrg, connections: [sampleEnabledConnection] }]);
    });

    it('should get all organizations', async () => {
      const organizationsPage1 = Array.from({ length: 50 }, (v, i) => ({
        name: 'acme' + i,
        display_name: 'Acme ' + i,
      }));
      const organizationsPage2 = Array.from({ length: 40 }, (v, i) => ({
        name: 'acme' + (i + 50),
        display_name: 'Acme ' + (i + 50),
      }));

      const auth0 = {
        organizations: {
          getAll: (params) =>
            Promise.resolve(
              mockPagedData(params, 'organizations', [...organizationsPage2, ...organizationsPage1])
            ),
          getEnabledConnections: () => Promise.resolve({ data: {} }),
        },
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.have.length(90);
    });

    it('should return an empty array for old versions of the sdk', async () => {
      const auth0 = {
        pool,
      };

      const handler = new organizations.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should return an empty array for 501 status code', async () => {
      const auth0 = {
        organizations: {
          getAll: () => {
            const error = new Error('Feature is not yet implemented');
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

    it('should return an empty array for 404 status code', async () => {
      const auth0 = {
        organizations: {
          getAll: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          },
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
          getAll: () => {
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
          getAll: (params) => {
            if (!shouldThrow) {
              return mockPagedData(params, 'organizations', [sampleOrg]);
            }

            throw new Error('Unexpected');
          },
          getEnabledConnections: () => Promise.resolve({ data: [] }),
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
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            Promise.resolve(
              mockPagedData({ ...params, include_totals: true }, 'organizations', [sampleOrg])
            ),
          getEnabledConnections: () => ({
            data: [sampleEnabledConnection, sampleEnabledConnection2],
          }),
          addEnabledConnection: (params, data) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(data).to.be.an('object');
            expect(data.connection_id).to.equal('con_789');
            expect(data.assign_membership_on_login).to.equal(false);
            return Promise.resolve({ data });
          },
          removeEnabledConnection: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(params.connection_id).to.equal(sampleEnabledConnection2.connection_id);
            return Promise.resolve({ data: undefined });
          },
          updateEnabledConnection: (params, data) => {
            if (params.connection_id === sampleEnabledConnection.connection_id) {
              expect(params).to.be.an('object');
              expect(params.id).to.equal('123');
              expect(params.connection_id).to.equal(sampleEnabledConnection.connection_id);
              expect(data).to.be.an('object');
              expect(data.assign_membership_on_login).to.equal(false);
              expect(data.show_as_button).to.equal(true);
              expect(data.is_signup_enabled).to.equal(false);
            } else {
              expect(params).to.be.an('object');
              expect(params.id).to.equal('123');
              expect(params.connection_id).to.equal(sampleEnabledConnection2.connection_id);
              expect(data).to.be.an('object');
              expect(data.assign_membership_on_login).to.equal(true);
              expect(data.show_as_button).to.equal(false);
            }
            return Promise.resolve(data);
          },
        },
        connections: {
          getAll: (params) =>
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
                  is_signup_enabled: false
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
          create: () => Promise.resolve({ data: [] }),
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          getEnabledConnections: () => ({ data: [] }),
          addEnabledConnection: (params, data) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(data).to.be.an('object');
            expect(data.connection_id).to.equal('con_123');
            expect(data.assign_membership_on_login).to.equal(false);
            expect(data.show_as_button).to.equal(false);
            expect(data.is_signup_enabled).to.equal(false);
            return Promise.resolve({ data });
          },
        },
        connections: {
          getAll: (params) =>
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
                  is_signup_enabled: false
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
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          getEnabledConnections: () => ({ data: [sampleEnabledConnection2] }),
          deleteEnabledConnection: (params) => {
            expect(params).to.be.an('object');
            expect(params.connectionId).to.equal(sampleEnabledConnection2.connection_id);
            return Promise.resolve({ data: [] });
          },
          removeEnabledConnection: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(params.connection_id).to.equal(sampleEnabledConnection2.connection_id);
            return Promise.resolve({ data: undefined });
          },
        },
        connections: {
          getAll: (params) =>
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
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('123');
            expect(data.display_name).to.equal('Acme 2');
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          getEnabledConnections: () => ({ data: [] }),
        },
        connections: {
          getAll: (params) =>
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
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal(sampleOrg.id);
            return Promise.resolve({ data });
          },
          getAll: (params) => Promise.resolve(mockPagedData(params, 'organizations', [sampleOrg])),
          getEnabledConnections: () => [],
        },
        connections: {
          getAll: (params) => mockPagedData(params, 'connections', []),
        },
        pool,
      };
      const handler = new organizations.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ organizations: [{}] }]);
    });
  });
});
