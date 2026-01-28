import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const roles = require('../../../../src/tools/auth0/handlers/roles');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#roles handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#roles validate', () => {
    it('should not allow same names', async () => {
      const handler = new roles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'myRole',
        },
        {
          name: 'myRole',
        },
      ];

      try {
        await stageFn.apply(handler, [{ roles: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new roles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'myRole',
        },
      ];

      await stageFn.apply(handler, [{ roles: data }]);
    });
  });

  describe('#roles process', () => {
    it('should create role', async () => {
      const auth0 = {
        roles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('myRole');
            expect(data.description).to.equal('myDescription');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'roles', []),
          permissions: {
            list: () =>
              Promise.resolve([
                { permission_name: 'Create:cal_entry', resource_server_identifier: 'organise' },
              ]),
            add: (roleId, data) => {
              expect(roleId).to.be.a('string');
              expect(roleId).to.equal('myRoleId');
              expect(data).to.be.an('object');
              expect(data.permissions).to.not.equal(null);
              expect(data.permissions).to.be.an('Array');
              return Promise.resolve(data.permissions);
            },
          },
        },
        pool,
      };
      const handler = new roles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [
        {
          roles: [
            {
              name: 'myRole',
              id: 'myRoleId',
              description: 'myDescription',
              permissions: [],
            },
          ],
        },
      ]);
    });

    it('should get roles', async () => {
      const permissions = new Array(150).fill({
        permission_name: 'Create:cal_entry',
        resource_server_identifier: 'organise',
      });

      const auth0 = {
        roles: {
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'roles', [
              {
                name: 'myRole',
                id: 'myRoleId',
                description: 'myDescription',
              },
            ]),
          permissions: {
            list: (roleId, params) =>
              mockPagedData({ ...params, include_totals: true }, 'permissions', permissions),
          },
        },
        pool,
      };

      const handler = new roles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        {
          name: 'myRole',
          id: 'myRoleId',
          description: 'myDescription',
          permissions: new Array(150).fill({
            permission_name: 'Create:cal_entry',
            resource_server_identifier: 'organise',
          }),
        },
      ]);
    });

    it('should handle multi-page pagination for role permissions', async () => {
      // Simulate 3 pages of permissions
      const page1Permissions = [
        { permission_name: 'read:users', resource_server_identifier: 'api1' },
        { permission_name: 'write:users', resource_server_identifier: 'api1' },
      ];
      const page2Permissions = [
        { permission_name: 'read:orders', resource_server_identifier: 'api2' },
        { permission_name: 'write:orders', resource_server_identifier: 'api2' },
      ];
      const page3Permissions = [
        { permission_name: 'delete:all', resource_server_identifier: 'api3' },
      ];

      const auth0 = {
        roles: {
          list: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'roles', [
              {
                name: 'adminRole',
                id: 'role_123',
                description: 'Admin role with multi-page permissions',
              },
            ]),
          permissions: {
            list: (roleId, params) =>
              mockPagedData(
                { ...params, include_totals: true },
                'permissions',
                page1Permissions,
                [page2Permissions, page3Permissions]
              ),
          },
        },
        pool,
      };

      const handler = new roles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      // Should include permissions from ALL 3 pages
      expect(data[0].permissions).to.deep.equal([
        { permission_name: 'read:users', resource_server_identifier: 'api1' },
        { permission_name: 'write:users', resource_server_identifier: 'api1' },
        { permission_name: 'read:orders', resource_server_identifier: 'api2' },
        { permission_name: 'write:orders', resource_server_identifier: 'api2' },
        { permission_name: 'delete:all', resource_server_identifier: 'api3' },
      ]);
    });

    it('should return an empty array for 501 status code', async () => {
      const auth0 = {
        roles: {
          list: () => {
            const error = new Error('Feature is not yet implemented');
            error.statusCode = 501;
            throw error;
          },
        },
        pool,
      };

      const handler = new roles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should return an empty array for 404 status code', async () => {
      const auth0 = {
        roles: {
          list: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          },
        },
        pool,
      };

      const handler = new roles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        roles: {
          list: () => {
            const error = new Error('Bad request');
            error.statusCode = 500;
            throw error;
          },
        },
        pool,
      };

      const handler = new roles.default({ client: pageClient(auth0), config });
      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
      }
    });

    it('should update role', async () => {
      const auth0 = {
        roles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.length).to.equal(0);
            return Promise.resolve(data);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('myRoleId');
            expect(data).to.be.an('object');
            expect(data.name).to.equal('myRole');
            expect(data.description).to.equal('myDescription');

            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'roles', [
              {
                name: 'myRole',
                id: 'myRoleId',
                description: 'myDescription',
              },
            ]),
          permissions: {
            list: (roleId, params) =>
              mockPagedData(params, 'permissions', [
                {
                  permission_name: 'Create:cal_entry',
                  resource_server_identifier: 'organise',
                },
              ]),
            delete: function (roleId, _data) {
              expect(roleId).to.be.a('string');
              expect(roleId).to.equal('myRoleId');
              return Promise.resolve([]);
            },
            add: function (roleId, _data) {
              expect(roleId).to.be.a('string');
              expect(roleId).to.equal('myRoleId');
              return Promise.resolve([]);
            },
          },
        },
        pool,
      };

      const handler = new roles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          roles: [
            {
              name: 'myRole',
              id: 'myRoleId',
              description: 'myDescription',
              permissions: [
                {
                  permission_name: 'Create:cal_entry',
                  resource_server_identifier: 'organise',
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should delete role', async () => {
      const auth0 = {
        roles: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (id) => {
            expect(id).to.be.a('string');
            expect(id).to.equal('myRoleId');
            return Promise.resolve({});
          },
          list: (params) =>
            mockPagedData(params, 'roles', [
              {
                name: 'myRole',
                id: 'myRoleId',
                description: 'myDescription',
              },
            ]),
          permissions: {
            list: (roleId, params) => mockPagedData(params, 'permissions', []),
          },
        },
        pool,
      };
      const handler = new roles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ roles: [{}] }]);
    });
  });
});
