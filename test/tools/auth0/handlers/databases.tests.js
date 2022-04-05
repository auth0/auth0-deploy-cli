const { expect } = require('chai');
const databases = require('../../../../src/tools/auth0/handlers/databases');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#databases handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#databases validate', () => {
    it('should not allow same names', async () => {
      const handler = new databases.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someDatabase',
        },
        {
          name: 'someDatabase',
        },
      ];

      try {
        await stageFn.apply(handler, [{ databases: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new databases.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;

      await stageFn.apply(handler, [{ databases: [{ name: 'someDatabase' }] }]);
    });
  });

  describe('#databases process', () => {
    it('should create database', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someDatabase');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          getAll: () => [],
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ databases: [{ name: 'someDatabase' }] }]);
    });

    it('should get databases', async () => {
      const clientId = 'rFeR6vyzQcDEgSUsASPeF4tXr3xbZhxE';
      const auth0 = {
        connections: {
          getAll: function () {
            (() => expect(this).to.not.be.undefined)();
            return [{ strategy: 'auth0', name: 'db', enabled_clients: [clientId] }];
          },
        },
        clients: {
          getAll: function () {
            (() => expect(this).to.not.be.undefined)();
            return [{ name: 'test client', client_id: clientId }];
          },
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([{ strategy: 'auth0', name: 'db', enabled_clients: [clientId] }]);
    });

    it('should update database', async () => {
      const auth0 = {
        connections: {
          get: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec'],
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [{ name: 'someDatabase', id: 'con1', strategy: 'auth0' }],
        },
        clients: {
          getAll: () => [{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: { passwordPolicy: 'testPolicy' },
          enabled_clients: ['client1'],
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    // If client is excluded and in the existing connection this client is enabled, it should keep enabled
    // If client is excluded and in the existing connection this client is disabled, it should keep disabled
    it('should handle excluded clients properly', async () => {
      const auth0 = {
        connections: {
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['client1-id', 'excluded-one-id'],
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [
            {
              name: 'someDatabase',
              id: 'con1',
              strategy: 'auth0',
              enabled_clients: ['excluded-one-id'],
            },
          ],
        },
        clients: {
          getAll: () => [
            { name: 'client1', client_id: 'client1-id' },
            { name: 'excluded-one', client_id: 'excluded-one-id' },
            { name: 'excluded-two', client_id: 'excluded-two-id' },
          ],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: { passwordPolicy: 'testPolicy' },
          enabled_clients: ['client1', 'excluded-one', 'excluded-two'],
        },
      ];

      await stageFn.apply(handler, [
        { databases: data, exclude: { clients: ['excluded-one', 'excluded-two'] } },
      ]);
    });

    it('should update database without "enabled_clients" setting', async () => {
      const auth0 = {
        connections: {
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            return Promise.resolve({});
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              options: { passwordPolicy: 'testPolicy' },
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [{ name: 'someDatabase', id: 'con1', strategy: 'auth0' }],
        },
        clients: {
          getAll: () => [{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: { passwordPolicy: 'testPolicy' },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should delete database and create another one instead', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someDatabase');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');

            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'auth0' }],
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someDatabase',
          strategy: 'custom',
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should delete all databases', async () => {
      let removed = false;
      const auth0 = {
        connections: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            removed = true;
            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'auth0' }],
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ databases: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        connections: {
          create: (data) => Promise.resolve(data),
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'auth0' }],
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someDatabase',
          strategy: 'custom',
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should not remove databases if run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };
      const auth0 = {
        connections: {
          create: () => Promise.resolve(),
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'auth0' }],
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ databases: [] }]);
    });

    it('should not remove/create/update excluded connections', async () => {
      config.data = {
        EXTENSION_SECRET: false,
        AUTH0_ALLOW_DELETE: true,
      };
      const auth0 = {
        connections: {
          create: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          update: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [
            { id: 'con1', name: 'existing1', strategy: 'auth0' },
            { id: 'con2', name: 'existing2', strategy: 'auth0' },
          ],
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new databases.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const assets = {
        exclude: {
          databases: ['existing1', 'existing2', 'existing3'],
        },
        databases: [{ name: 'existing3', strategy: 'auth0' }],
      };

      await stageFn.apply(handler, [assets]);
    });
  });
});
