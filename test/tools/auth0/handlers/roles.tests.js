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
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'roles', []),
          permissions: {
            getAll: () =>
              Promise.resolve([
                { permission_name: 'Create:cal_entry', resource_server_identifier: 'organise' },
              ]),
            create: (params, data) => {
              expect(params).to.be.an('object');
              expect(params.id).to.equal('myRoleId');
              expect(data).to.be.an('object');
              expect(data.permissions).to.not.equal(null);
              expect(data.permissions).to.be.an('Array');
              return Promise.resolve({ data: data.permissions });
            },
            update: Promise.resolve({ data: [] }),
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
          getAll: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'roles', [
              {
                name: 'myRole',
                id: 'myRoleId',
                description: 'myDescription',
              },
            ]),
          getPermissions: (params) =>
            mockPagedData({ ...params, include_totals: true }, 'permissions', permissions),
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

    it('should return an empty array for 501 status code', async () => {
      const auth0 = {
        roles: {
          getAll: () => {
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
          getAll: () => {
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
          getAll: () => {
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
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('myRoleId');
            expect(data).to.be.an('object');
            expect(data.name).to.equal('myRole');
            expect(data.description).to.equal('myDescription');

            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'roles', [
              {
                name: 'myRole',
                id: 'myRoleId',
                description: 'myDescription',
              },
            ]),
          getPermissions: (params) =>
            mockPagedData(params, 'permissions', [
              {
                permission_name: 'Create:cal_entry',
                resource_server_identifier: 'organise',
              },
            ]),
          deletePermissions: function (params) {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('myRoleId');
            return Promise.resolve({ data: [] });
          },
          addPermissions: function (params) {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('myRoleId');
            return Promise.resolve({ data: [] });
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
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('myRoleId');
            return Promise.resolve({ data });
          },
          getAll: (params) =>
            mockPagedData(params, 'roles', [
              {
                name: 'myRole',
                id: 'myRoleId',
                description: 'myDescription',
              },
            ]),
          getPermissions: (params) => mockPagedData(params, 'permissions', []),
        },
        pool,
      };
      const handler = new roles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ roles: [{}] }]);
    });
  });
});
