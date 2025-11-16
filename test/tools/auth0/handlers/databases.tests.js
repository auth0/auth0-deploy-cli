import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const sinon = require('sinon');
const databases = require('../../../../src/tools/auth0/handlers/databases');
const connections = require('../../../../src/tools/auth0/handlers/connections');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
  addSingleTask: (task) => {
    const result = task.generator(task.data);
    return { promise: () => Promise.resolve(result) };
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

    it('should validate database with email.unique property', async () => {
      const handler = new databases.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;

      const data = [
        {
          name: 'testDatabase',
          options: {
            attributes: {
              email: {
                unique: true,
                identifier: { active: true },
              },
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
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
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ databases: [{ name: 'someDatabase' }] }]);
    });

    it('should throw error when creating database with email.unique false and email.identifier.active true', async () => {
      const handler = new databases.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;

      const data = [
        {
          name: 'invalidDatabase',
          strategy: 'auth0',
          options: {
            attributes: {
              email: {
                unique: false,
                identifier: { active: true },
              },
            },
          },
        },
      ];

      try {
        await stageFn.apply(handler, [{ databases: data }]);
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.include(
          'Cannot set email.identifier.active to true when email.unique is false'
        );
        expect(error.message).to.include('invalidDatabase');
      }
    });

    it('should successfully create database with email.unique false and valid configuration', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            expect(data.name).to.equal('validDatabase');
            expect(data.options.attributes.email.identifier.active).to.equal(false);
            expect(data.options.attributes.username.identifier.active).to.equal(true);
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'validDatabase',
          strategy: 'auth0',
          options: {
            attributes: {
              email: {
                unique: false,
                identifier: { active: false },
              },
              username: {
                identifier: { active: true },
              },
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should successfully create database with email.unique false and username.identifier.active true', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            expect(data.name).to.equal('testDatabase');
            expect(data.options.attributes.email.unique).to.equal(false);
            expect(data.options.attributes.email.identifier.active).to.equal(false);
            expect(data.options.attributes.username.identifier.active).to.equal(true);
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'testDatabase',
          strategy: 'auth0',
          options: {
            attributes: {
              email: {
                unique: false,
                identifier: { active: false },
              },
              username: {
                identifier: { active: true },
              },
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should successfully update database when email.unique is not mentioned and email.identifier.active is true', async () => {
      const auth0 = {
        connections: {
          get: function (params) {
            expect(params.id).to.equal('con1');
            return Promise.resolve({ data: { options: { someOldOption: true } } });
          },
          update: function (params, data) {
            expect(params.id).to.equal('con1');
            expect(data.options.attributes.email.identifier.active).to.equal(true);
            return Promise.resolve({ data: { ...params, ...data } });
          },
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { name: 'testDatabase', id: 'con1', strategy: 'auth0' },
            ]),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'testDatabase',
          strategy: 'auth0',
          options: {
            attributes: {
              email: {
                // unique not mentioned - should default to true
                identifier: { active: true },
              },
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should throw error when creating database with no active identifiers', async () => {
      const handler = new databases.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;

      const data = [
        {
          name: 'invalidDatabase',
          strategy: 'auth0',
          options: {
            attributes: {
              email: {
                unique: true,
                identifier: { active: false },
              },
              username: {
                identifier: { active: false },
              },
              phone_number: {
                identifier: { active: false },
              },
            },
          },
        },
      ];

      try {
        await stageFn.apply(handler, [{ databases: data }]);
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.include('At least one identifier must be active');
        expect(error.message).to.include('invalidDatabase');
      }
    });

    it('should get databases', async () => {
      const clientId = 'rFeR6vyzQcDEgSUsASPeF4tXr3xbZhxE';
      let getEnabledClientsCalledOnce = false;
      const auth0 = {
        connections: {
          list: function (params) {
            (() => expect(this).to.not.be.undefined)();
            return mockPagedData(params, 'connections', [
              { id: 'con1', strategy: 'auth0', name: 'db', enabled_clients: [clientId] },
            ]);
          },
          clients: {
            get: () => {
              getEnabledClientsCalledOnce = true;
              return Promise.resolve(mockPagedData({}, 'clients', [{ client_id: clientId }]));
            },
          },
        },
        clients: {
          list: function (params) {
            (() => expect(this).to.not.be.undefined)();
            return mockPagedData(params, 'clients', [{ name: 'test client', client_id: clientId }]);
          },
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { id: 'con1', strategy: 'auth0', name: 'db', enabled_clients: [clientId] },
      ]);
      expect(getEnabledClientsCalledOnce).to.equal(true);
    });

    it('should update database', async () => {
      const auth0 = {
        connections: {
          get: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec'],
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...data, id });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData(params, 'connections', [
              { name: 'someDatabase', id: 'con1', strategy: 'auth0' },
            ]),
          clients: {
            get: () => Promise.resolve(mockPagedData({}, 'clients', [])),
            update: (connectionId) => {
              expect(connectionId).to.equal('con1');
              return Promise.resolve({});
            },
          },
        },
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
            ]),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
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
          get: (id) => {
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['client1-id', 'excluded-one-id'],
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...data, id });
          },
          delete: () => Promise.resolve({ data: [] }),
          list: (params) =>
            mockPagedData(params, 'connections', [
              {
                name: 'someDatabase',
                id: 'con1',
                strategy: 'auth0',
                enabled_clients: ['excluded-one-id'],
              },
            ]),
          clients: {
            get: () => Promise.resolve(mockPagedData({}, 'clients', [])),
            update: (connectionId) => {
              expect(connectionId).to.equal('con1');
              return Promise.resolve({});
            },
          },
        },
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client1', client_id: 'client1-id' },
              { name: 'excluded-one', client_id: 'excluded-one-id' },
              { name: 'excluded-two', client_id: 'excluded-two-id' },
            ]),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
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
          get: (id) => {
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            return Promise.resolve({ data: {} });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            expect(data).to.deep.equal({
              options: { passwordPolicy: 'testPolicy' },
            });

            return Promise.resolve({ ...data, id });
          },
          delete: () => Promise.resolve([]),
          list: (params) =>
            mockPagedData(params, 'connections', [
              { name: 'someDatabase', id: 'con1', strategy: 'auth0' },
            ]),
          clients: {
            get: () => Promise.resolve(mockPagedData({}, 'clients', [])),
            update: (connectionId) => {
              expect(connectionId).to.be.undefined();
              return false;
            },
          },
        },
        clients: {
          list: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
            ]),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
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
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');

            return Promise.resolve({ data: [] });
          },
          list: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'auth0' },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
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
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            removed = true;
            return Promise.resolve({ data: [] });
          },
          list: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'auth0' },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
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
          delete: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          list: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'auth0' },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
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
          create: () => Promise.resolve({ data: undefined }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          list: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'auth0' },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
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
          create: () => {
            expect(false).to.be.true(); // Should not be called
            return Promise.resolve({ data: [] });
          },
          update: () => {
            expect(false).to.be.true(); // Should not be called
            return Promise.resolve({ data: [] });
          },
          delete: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          list: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existing1', strategy: 'auth0' },
              { id: 'con2', name: 'existing2', strategy: 'auth0' },
            ]),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const assets = {
        exclude: {
          databases: ['existing1', 'existing2', 'existing3'],
        },
        databases: [{ name: 'existing3', strategy: 'auth0' }],
      };

      await stageFn.apply(handler, [assets]);
    });

    it('should update database when attributes are passed', async () => {
      const auth0 = {
        connections: {
          get: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            expect(data).to.deep.equal({
              attributes: {
                email: {
                  signup: {
                    status: 'required',
                    verification: {
                      active: false,
                    },
                  },
                  identifier: {
                    active: true,
                  },
                  profile_required: true,
                  verification_method: 'otp',
                },
                username: {
                  signup: {
                    status: 'required',
                  },
                  identifier: {
                    active: true,
                  },
                  validation: {
                    max_length: 15,
                    min_length: 1,
                    allowed_types: {
                      email: false,
                      phone_number: false,
                    },
                  },
                  profile_required: true,
                },
              },
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...data, id });
          },
          delete: () => Promise.resolve([]),
          list: () => [{ name: 'someDatabase', id: 'con1', strategy: 'auth0' }],
        },
        clients: {
          list: () => [{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }],
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
          attributes: {
            email: {
              signup: {
                status: 'required',
                verification: {
                  active: false,
                },
              },
              identifier: {
                active: true,
              },
              profile_required: true,
              verification_method: 'otp',
            },
            username: {
              signup: {
                status: 'required',
              },
              identifier: {
                active: true,
              },
              validation: {
                max_length: 15,
                min_length: 1,
                allowed_types: {
                  email: false,
                  phone_number: false,
                },
              },
              profile_required: true,
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should update database when require username and validation are passed', async () => {
      const auth0 = {
        connections: {
          get: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            expect(data).to.deep.equal({
              validation: {
                username: {
                  max: 15,
                  min: 1,
                },
              },
              requires_username: true,
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...data, id });
          },
          delete: () => Promise.resolve([]),
          list: () => [{ name: 'someDatabase', id: 'con1', strategy: 'auth0' }],
        },
        clients: {
          list: () => [{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }],
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
          validation: {
            username: {
              max: 15,
              min: 1,
            },
          },
          requires_username: true,
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should fail to update database when require username and validation and attributes are passed', async () => {
      const getStub = sinon.stub().resolves({ options: { someOldOption: true } });
      const updateStub = sinon.stub().resolves({
        id: 'con1',
      });
      const logWarnSpy = sinon.spy(console, 'warn');
      const deleteStub = sinon.stub().resolves([]);
      const getAllStub = sinon.stub().resolves([
        {
          name: 'someDatabase',
          id: 'con1',
          strategy: 'auth0',
          validation: {
            username: {
              max: 15,
              min: 1,
            },
          },
          requires_username: true,
        },
      ]);
      const auth0 = {
        connections: {
          get: getStub,
          update: updateStub,
          delete: deleteStub,
          list: getAllStub,
        },
        clients: {
          list: sinon
            .stub()
            .resolves([{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }]),
        },
        pool: pool,
      };

      const handler = new databases.default({ client: auth0, config });
      handler.getClientFN = function (fn) {
        if (fn === 'update') {
          return (params, payload) =>
            this.client.connections.get(params).then((connection) => {
              const attributes = payload?.options?.attributes;
              const requiresUsername = payload?.options?.requires_username;
              const validation = payload?.options?.validation;

              if (attributes && (requiresUsername || validation)) {
                console.warn(
                  'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
                );
                throw new Error('Cannot set both attributes and requires_username or validation');
              }

              if (attributes) {
                delete connection.options.validation;
                delete connection.options.requires_username;
              }

              if (requiresUsername || validation) {
                delete connection.options.attributes;
              }

              payload.options = { ...connection.options, ...payload.options };
              return this.client.connections.update(params, payload);
            });
        }

        return this.client.connections[fn].bind(this.client.connections);
      };

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: {
            passwordPolicy: 'testPolicy',
            attributes: {
              email: {
                signup: {
                  status: 'required',
                  verification: {
                    active: false,
                  },
                },
                identifier: {
                  active: true,
                },
                profile_required: true,
              },
              username: {
                signup: {
                  status: 'required',
                },
                identifier: {
                  active: true,
                },
                validation: {
                  max_length: 15,
                  min_length: 1,
                  allowed_types: {
                    email: false,
                    phone_number: false,
                  },
                },
                profile_required: true,
              },
            },
            validation: {
              username: {
                max: 15,
                min: 1,
              },
            },
            requires_username: true,
          },
        },
      ];

      try {
        await stageFn.apply(handler, [{ databases: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include(
          'Cannot set both attributes and requires_username or validation'
        );
      }

      // eslint-disable-next-line no-unused-expressions
      expect(logWarnSpy.calledOnce).to.be.true;
      // eslint-disable-next-line no-unused-expressions
      expect(
        logWarnSpy.calledWith(
          'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
        )
      ).to.be.true;

      sinon.assert.calledOnce(getStub);
      sinon.assert.notCalled(updateStub);

      logWarnSpy.restore();
    });

    it('should update database with attributes and remove validation from the update request if validation is in the get response but attributes are in the update request', async () => {
      const getStub = sinon.stub().resolves({
        options: {
          someOldOption: true,
          validation: {
            username: {
              max: 15,
              min: 1,
            },
          },
        },
      });
      const updateStub = sinon.stub().resolves({
        id: 'con1',
      });
      const deleteStub = sinon.stub().resolves([]);
      const getAllStub = sinon.stub().resolves([
        {
          name: 'someDatabase',
          id: 'con1',
          strategy: 'auth0',
          options: {
            validation: {
              username: {
                max: 15,
                min: 1,
              },
            },
          },
        },
      ]);
      const auth0 = {
        connections: {
          get: getStub,
          update: updateStub,
          delete: deleteStub,
          list: getAllStub,
        },
        clients: {
          list: sinon
            .stub()
            .resolves([{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }]),
        },
        pool: pool,
      };

      const handler = new databases.default({ client: auth0, config });
      handler.getClientFN = function (fn) {
        if (fn === 'update') {
          return (params, payload) =>
            this.client.connections.get(params).then((connection) => {
              const attributes = payload?.options?.attributes;
              const requiresUsername = payload?.options?.requires_username;
              const validation = payload?.options?.validation;
              if (attributes && (requiresUsername || validation)) {
                console.warn(
                  'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
                );
                throw new Error('Cannot set both attributes and requires_username or validation');
              }

              if (attributes) {
                console.info('Info: "Removed Validation from Connection Payload"');
                delete connection.options.validation;
                delete connection.options.requires_username;
              }

              if (requiresUsername || validation) {
                console.info('Info: "Removed Attributes from Connection Payload"');
                delete connection.options.attributes;
              }

              payload.options = { ...connection.options, ...payload.options };
              return this.client.connections.update(params, payload);
            });
        }

        return this.client.connections[fn].bind(this.client.connections);
      };

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: {
            passwordPolicy: 'testPolicy',
            attributes: {
              email: {
                signup: {
                  status: 'required',
                  verification: {
                    active: false,
                  },
                },
                identifier: {
                  active: true,
                },
                profile_required: true,
                verification_method: 'link',
              },
              username: {
                signup: {
                  status: 'required',
                },
                identifier: {
                  active: true,
                },
                validation: {
                  max_length: 15,
                  min_length: 1,
                  allowed_types: {
                    email: false,
                    phone_number: false,
                  },
                },
                profile_required: true,
              },
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);

      sinon.assert.calledOnce(getStub);
      sinon.assert.calledOnce(updateStub);
      const updateArgs = updateStub.firstCall.args[1];

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.attributes).to.exist;
      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.validation).to.not.exist;
    });

    it('should update database with validation & require username and remove attributes from the update request if attributes is in the get response but validation and require username are in the update request', async () => {
      const getStub = sinon.stub().resolves({
        options: {
          someOldOption: true,
          attributes: {
            email: {
              signup: {
                status: 'required',
                verification: {
                  active: false,
                },
              },
              identifier: {
                active: true,
              },
              profile_required: true,
            },
            username: {
              signup: {
                status: 'required',
              },
              identifier: {
                active: true,
              },
              validation: {
                max_length: 15,
                min_length: 1,
                allowed_types: {
                  email: false,
                  phone_number: false,
                },
              },
              profile_required: true,
            },
          },
        },
      });
      const updateStub = sinon.stub().resolves({
        id: 'con1',
      });
      const deleteStub = sinon.stub().resolves([]);
      const getAllStub = sinon.stub().resolves([
        {
          name: 'someDatabase',
          id: 'con1',
          strategy: 'auth0',
          options: {
            attributes: {
              email: {
                signup: {
                  status: 'required',
                  verification: {
                    active: false,
                  },
                },
                identifier: {
                  active: true,
                },
                profile_required: true,
              },
              username: {
                signup: {
                  status: 'required',
                },
                identifier: {
                  active: true,
                },
                validation: {
                  max_length: 15,
                  min_length: 1,
                  allowed_types: {
                    email: false,
                    phone_number: false,
                  },
                },
                profile_required: true,
              },
            },
          },
        },
      ]);
      const auth0 = {
        connections: {
          get: getStub,
          update: updateStub,
          delete: deleteStub,
          list: getAllStub,
        },
        clients: {
          list: sinon
            .stub()
            .resolves([{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }]),
        },
        pool: pool,
      };

      const handler = new databases.default({ client: auth0, config });
      handler.getClientFN = function (fn) {
        if (fn === 'update') {
          return (params, payload) =>
            this.client.connections.get(params).then((connection) => {
              const attributes = payload?.options?.attributes;
              const requiresUsername = payload?.options?.requires_username;
              const validation = payload?.options?.validation;

              if (attributes && (requiresUsername || validation)) {
                console.warn(
                  'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
                );
                throw new Error('Cannot set both attributes and requires_username or validation');
              }

              if (attributes) {
                console.info('Info: "Removed Validation from Connection Payload"');
                delete connection.options.validation;
                delete connection.options.requires_username;
              }

              if (requiresUsername || validation) {
                console.info('Info: "Removed Attributes from Connection Payload"');
                delete connection.options.attributes;
              }

              payload.options = { ...connection.options, ...payload.options };
              return this.client.connections.update(params, payload);
            });
        }

        return this.client.connections[fn].bind(this.client.connections);
      };

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: {
            passwordPolicy: 'testPolicy',
            validation: {
              username: {
                max: 15,
                min: 1,
              },
            },
            requires_username: true,
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);

      sinon.assert.calledOnce(getStub);
      sinon.assert.calledOnce(updateStub);
      const updateArgs = updateStub.firstCall.args[1];

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.attributes).to.not.exist;

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.validation).to.exist;

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.requires_username).to.exist;
    });

    it('should update database when attributes are passed', async () => {
      const auth0 = {
        connections: {
          get: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            expect(data).to.deep.equal({
              attributes: {
                email: {
                  signup: {
                    status: 'required',
                    verification: {
                      active: false,
                    },
                  },
                  identifier: {
                    active: true,
                  },
                  profile_required: true,
                  verification_method: 'otp',
                },
                username: {
                  signup: {
                    status: 'required',
                  },
                  identifier: {
                    active: true,
                  },
                  validation: {
                    max_length: 15,
                    min_length: 1,
                    allowed_types: {
                      email: false,
                      phone_number: false,
                    },
                  },
                  profile_required: true,
                },
              },
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...data, id });
          },
          delete: () => Promise.resolve([]),
          list: () => [{ name: 'someDatabase', id: 'con1', strategy: 'auth0' }],
        },
        clients: {
          list: () => [{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }],
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
          attributes: {
            email: {
              signup: {
                status: 'required',
                verification: {
                  active: false,
                },
              },
              identifier: {
                active: true,
              },
              profile_required: true,
              verification_method: 'otp',
            },
            username: {
              signup: {
                status: 'required',
              },
              identifier: {
                active: true,
              },
              validation: {
                max_length: 15,
                min_length: 1,
                allowed_types: {
                  email: false,
                  phone_number: false,
                },
              },
              profile_required: true,
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should update database when require username and validation are passed', async () => {
      const auth0 = {
        connections: {
          get: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            return Promise.resolve({ options: { someOldOption: true } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal('con1');
            expect(data).to.deep.equal({
              validation: {
                username: {
                  max: 15,
                  min: 1,
                },
              },
              requires_username: true,
              options: { passwordPolicy: 'testPolicy', someOldOption: true },
            });

            return Promise.resolve({ ...data, id });
          },
          delete: () => Promise.resolve([]),
          list: () => [{ name: 'someDatabase', id: 'con1', strategy: 'auth0' }],
        },
        clients: {
          list: () => [{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }],
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
          validation: {
            username: {
              max: 15,
              min: 1,
            },
          },
          requires_username: true,
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);
    });

    it('should fail to update database when require username and validation and attributes are passed', async () => {
      const getStub = sinon.stub().resolves({ options: { someOldOption: true } });
      const updateStub = sinon.stub().resolves({
        id: 'con1',
      });
      const logWarnSpy = sinon.spy(console, 'warn');
      const deleteStub = sinon.stub().resolves([]);
      const getAllStub = sinon.stub().resolves([
        {
          name: 'someDatabase',
          id: 'con1',
          strategy: 'auth0',
          validation: {
            username: {
              max: 15,
              min: 1,
            },
          },
          requires_username: true,
        },
      ]);
      const auth0 = {
        connections: {
          get: getStub,
          update: updateStub,
          delete: deleteStub,
          list: getAllStub,
        },
        clients: {
          list: sinon
            .stub()
            .resolves([{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }]),
        },
        pool: pool,
      };

      const handler = new databases.default({ client: auth0, config });
      handler.getClientFN = function (fn) {
        if (fn === 'update') {
          return (params, payload) =>
            this.client.connections.get(params).then((connection) => {
              const attributes = payload?.options?.attributes;
              const requiresUsername = payload?.options?.requires_username;
              const validation = payload?.options?.validation;

              if (attributes && (requiresUsername || validation)) {
                console.warn(
                  'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
                );
                throw new Error('Cannot set both attributes and requires_username or validation');
              }

              if (attributes) {
                delete connection.options.validation;
                delete connection.options.requires_username;
              }

              if (requiresUsername || validation) {
                delete connection.options.attributes;
              }

              payload.options = { ...connection.options, ...payload.options };
              return this.client.connections.update(params, payload);
            });
        }

        return this.client.connections[fn].bind(this.client.connections);
      };

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: {
            passwordPolicy: 'testPolicy',
            attributes: {
              email: {
                signup: {
                  status: 'required',
                  verification: {
                    active: false,
                  },
                },
                identifier: {
                  active: true,
                },
                verification_method: 'link',
                profile_required: true,
              },
              username: {
                signup: {
                  status: 'required',
                },
                identifier: {
                  active: true,
                },
                validation: {
                  max_length: 15,
                  min_length: 1,
                  allowed_types: {
                    email: false,
                    phone_number: false,
                  },
                },
                profile_required: true,
              },
            },
            validation: {
              username: {
                max: 15,
                min: 1,
              },
            },
            requires_username: true,
          },
        },
      ];

      try {
        await stageFn.apply(handler, [{ databases: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include(
          'Cannot set both attributes and requires_username or validation'
        );
      }

      // eslint-disable-next-line no-unused-expressions
      expect(logWarnSpy.calledOnce).to.be.true;
      // eslint-disable-next-line no-unused-expressions
      expect(
        logWarnSpy.calledWith(
          'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
        )
      ).to.be.true;

      sinon.assert.calledOnce(getStub);
      sinon.assert.notCalled(updateStub);

      logWarnSpy.restore();
    });

    it('should update database with attributes and remove validation from the update request if validation is in the get response but attributes are in the update request', async () => {
      const getStub = sinon.stub().resolves({
        options: {
          someOldOption: true,
          validation: {
            username: {
              max: 15,
              min: 1,
            },
          },
        },
      });
      const updateStub = sinon.stub().resolves({
        id: 'con1',
      });
      const deleteStub = sinon.stub().resolves([]);
      const getAllStub = sinon.stub().resolves([
        {
          name: 'someDatabase',
          id: 'con1',
          strategy: 'auth0',
          options: {
            validation: {
              username: {
                max: 15,
                min: 1,
              },
            },
          },
        },
      ]);
      const auth0 = {
        connections: {
          get: getStub,
          update: updateStub,
          delete: deleteStub,
          list: getAllStub,
        },
        clients: {
          list: sinon
            .stub()
            .resolves([{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }]),
        },
        pool: pool,
      };

      const handler = new databases.default({ client: auth0, config });
      handler.getClientFN = function (fn) {
        if (fn === 'update') {
          return (params, payload) =>
            this.client.connections.get(params).then((connection) => {
              const attributes = payload?.options?.attributes;
              const requiresUsername = payload?.options?.requires_username;
              const validation = payload?.options?.validation;
              if (attributes && (requiresUsername || validation)) {
                console.warn(
                  'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
                );
                throw new Error('Cannot set both attributes and requires_username or validation');
              }

              if (attributes) {
                console.info('Info: "Removed Validation from Connection Payload"');
                delete connection.options.validation;
                delete connection.options.requires_username;
              }

              if (requiresUsername || validation) {
                console.info('Info: "Removed Attributes from Connection Payload"');
                delete connection.options.attributes;
              }

              payload.options = { ...connection.options, ...payload.options };
              return this.client.connections.update(params, payload);
            });
        }

        return this.client.connections[fn].bind(this.client.connections);
      };

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: {
            passwordPolicy: 'testPolicy',
            attributes: {
              email: {
                signup: {
                  status: 'required',
                  verification: {
                    active: false,
                  },
                },
                identifier: {
                  active: true,
                },
                profile_required: true,
                verification_method: 'link',
              },
              username: {
                signup: {
                  status: 'required',
                },
                identifier: {
                  active: true,
                },
                validation: {
                  max_length: 15,
                  min_length: 1,
                  allowed_types: {
                    email: false,
                    phone_number: false,
                  },
                },
                profile_required: true,
              },
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);

      sinon.assert.calledOnce(getStub);
      sinon.assert.calledOnce(updateStub);
      const updateArgs = updateStub.firstCall.args[1];

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.attributes).to.exist;
      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.validation).to.not.exist;
    });

    it('should update database with validation & require username and remove attributes from the update request if attributes is in the get response but validation and require username are in the update request', async () => {
      const getStub = sinon.stub().resolves({
        options: {
          someOldOption: true,
          attributes: {
            email: {
              signup: {
                status: 'required',
                verification: {
                  active: false,
                },
              },
              identifier: {
                active: true,
              },
              profile_required: true,
            },
            username: {
              signup: {
                status: 'required',
              },
              identifier: {
                active: true,
              },
              validation: {
                max_length: 15,
                min_length: 1,
                allowed_types: {
                  email: false,
                  phone_number: false,
                },
              },
              profile_required: true,
            },
          },
        },
      });
      const updateStub = sinon.stub().resolves({
        id: 'con1',
      });
      const deleteStub = sinon.stub().resolves([]);
      const getAllStub = sinon.stub().resolves([
        {
          name: 'someDatabase',
          id: 'con1',
          strategy: 'auth0',
          options: {
            attributes: {
              email: {
                signup: {
                  status: 'required',
                  verification: {
                    active: false,
                  },
                },
                identifier: {
                  active: true,
                },
                profile_required: true,
              },
              username: {
                signup: {
                  status: 'required',
                },
                identifier: {
                  active: true,
                },
                validation: {
                  max_length: 15,
                  min_length: 1,
                  allowed_types: {
                    email: false,
                    phone_number: false,
                  },
                },
                profile_required: true,
              },
            },
          },
        },
      ]);
      const auth0 = {
        connections: {
          get: getStub,
          update: updateStub,
          delete: deleteStub,
          list: getAllStub,
        },
        clients: {
          list: sinon
            .stub()
            .resolves([{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }]),
        },
        pool: pool,
      };

      const handler = new databases.default({ client: auth0, config });
      handler.getClientFN = function (fn) {
        if (fn === 'update') {
          return (params, payload) =>
            this.client.connections.get(params).then((connection) => {
              const attributes = payload?.options?.attributes;
              const requiresUsername = payload?.options?.requires_username;
              const validation = payload?.options?.validation;

              if (attributes && (requiresUsername || validation)) {
                console.warn(
                  'Warning: "attributes" cannot be used with "requires_username" or "validation". Please remove one of the conflicting options.'
                );
                throw new Error('Cannot set both attributes and requires_username or validation');
              }

              if (attributes) {
                console.info('Info: "Removed Validation from Connection Payload"');
                delete connection.options.validation;
                delete connection.options.requires_username;
              }

              if (requiresUsername || validation) {
                console.info('Info: "Removed Attributes from Connection Payload"');
                delete connection.options.attributes;
              }

              payload.options = { ...connection.options, ...payload.options };
              return this.client.connections.update(params, payload);
            });
        }

        return this.client.connections[fn].bind(this.client.connections);
      };

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const data = [
        {
          name: 'someDatabase',
          strategy: 'auth0',
          options: {
            passwordPolicy: 'testPolicy',
            validation: {
              username: {
                max: 15,
                min: 1,
              },
            },
            requires_username: true,
          },
        },
      ];

      await stageFn.apply(handler, [{ databases: data }]);

      sinon.assert.calledOnce(getStub);
      sinon.assert.calledOnce(updateStub);
      const updateArgs = updateStub.firstCall.args[1];

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.attributes).to.not.exist;

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.validation).to.exist;

      // eslint-disable-next-line no-unused-expressions
      expect(updateArgs.options.requires_username).to.exist;
    });
  });
});

describe('#databases handler with enabled clients integration', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  afterEach(() => {
    sinon.restore();
  });

  describe('#getType with enabled clients', () => {
    it('should fetch and include enabled clients in database connection data', async () => {
      const getEnabledClientsStub = sinon.stub();
      const auth0 = {
        connections: {
          list: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con_1', strategy: 'auth0', name: 'database-connection-1' },
              { id: 'con_2', strategy: 'auth0', name: 'database-connection-2' },
            ]),
          clients: {
            get: getEnabledClientsStub,
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      // Mock enabled clients responses
      getEnabledClientsStub
        .withArgs('con_1')
        .resolves(
          mockPagedData({}, 'clients', [{ client_id: 'client_1' }, { client_id: 'client_2' }])
        )
        .withArgs('con_2')
        .resolves(mockPagedData({}, 'clients', [{ client_id: 'client_3' }]));

      const handler = new databases.default({ client: pageClient(auth0), config });

      const result = await handler.getType();

      expect(result).to.have.length(2);
      expect(result[0]).to.include({
        id: 'con_1',
        strategy: 'auth0',
        name: 'database-connection-1',
      });
      expect(result[0].enabled_clients).to.deep.equal(['client_1', 'client_2']);
      expect(result[1]).to.include({
        id: 'con_2',
        strategy: 'auth0',
        name: 'database-connection-2',
      });
      expect(result[1].enabled_clients).to.deep.equal(['client_3']);
    });

    it('should handle database connections without enabled clients', async () => {
      const auth0 = {
        connections: {
          list: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con_1', strategy: 'auth0', name: 'database-connection-1' },
            ]),
          clients: {
            get: sinon.stub().resolves(mockPagedData({}, 'clients', [])),
          },
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });

      const result = await handler.getType();

      expect(result).to.have.length(1);
      expect(result[0]).to.not.have.property('enabled_clients');
    });
  });

  describe('#processChanges with enabled clients', () => {
    it('should call processConnectionEnabledClients after super.processChanges for databases', async () => {
      const processConnectionEnabledClientsStub = sinon
        .stub(connections, 'processConnectionEnabledClients')
        .resolves();

      const auth0 = {
        connections: {
          create: sinon.stub().resolves({ data: {} }),
          update: sinon.stub().resolves({ data: {} }),
          delete: sinon.stub().resolves({ data: {} }),
          get: sinon.stub().resolves({ data: { options: {} } }),
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });

      const assets = {
        databases: [{ name: 'test-database', strategy: 'auth0', enabled_clients: ['client_1'] }],
      };

      await handler.processChanges(assets);

      sinon.assert.calledOnce(processConnectionEnabledClientsStub);
      expect(processConnectionEnabledClientsStub.firstCall.args[0]).to.equal(handler.client);
      expect(processConnectionEnabledClientsStub.firstCall.args[1]).to.equal(handler.type);

      processConnectionEnabledClientsStub.restore();
    });

    it('should respect excluded databases in enabled clients processing', async () => {
      const processConnectionEnabledClientsStub = sinon
        .stub(connections, 'processConnectionEnabledClients')
        .resolves();

      const auth0 = {
        connections: {
          create: sinon.stub().resolves({ data: {} }),
          update: sinon.stub().resolves({ data: {} }),
          delete: sinon.stub().resolves({ data: {} }),
          get: sinon.stub().resolves({ data: { options: {} } }),
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });

      const assets = {
        databases: [
          { name: 'included-database', strategy: 'auth0', enabled_clients: ['client_1'] },
          { name: 'excluded-database', strategy: 'auth0', enabled_clients: ['client_2'] },
        ],
        exclude: {
          databases: ['excluded-database'],
        },
      };

      await handler.processChanges(assets);

      sinon.assert.calledOnce(processConnectionEnabledClientsStub);

      // Verify that excluded databases are filtered out
      const passedChanges = processConnectionEnabledClientsStub.firstCall.args[2];
      expect(passedChanges.create).to.be.an('array');
      expect(passedChanges.update).to.be.an('array');
      expect(passedChanges.conflicts).to.be.an('array');

      processConnectionEnabledClientsStub.restore();
    });

    it('should pass database type to processConnectionEnabledClients', async () => {
      const processConnectionEnabledClientsStub = sinon
        .stub(connections, 'processConnectionEnabledClients')
        .resolves();

      const auth0 = {
        connections: {
          create: sinon.stub().resolves({ data: {} }),
          update: sinon.stub().resolves({ data: {} }),
          delete: sinon.stub().resolves({ data: {} }),
          get: sinon.stub().resolves({ data: { options: {} } }),
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });

      const assets = {
        databases: [{ name: 'test-database', strategy: 'auth0', enabled_clients: ['client_1'] }],
      };

      await handler.processChanges(assets);

      sinon.assert.calledOnce(processConnectionEnabledClientsStub);
      expect(processConnectionEnabledClientsStub.firstCall.args[1]).to.equal('databases');

      processConnectionEnabledClientsStub.restore();
    });

    it('should handle databases without enabled_clients property', async () => {
      const processConnectionEnabledClientsStub = sinon
        .stub(connections, 'processConnectionEnabledClients')
        .resolves();

      const auth0 = {
        connections: {
          create: sinon.stub().resolves({ data: {} }),
          update: sinon.stub().resolves({ data: {} }),
          delete: sinon.stub().resolves({ data: {} }),
          get: sinon.stub().resolves({ data: { options: {} } }),
          list: (params) => mockPagedData(params, 'connections', []),
        },
        clients: {
          list: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new databases.default({ client: pageClient(auth0), config });

      const assets = {
        databases: [
          { name: 'database-with-clients', strategy: 'auth0', enabled_clients: ['client_1'] },
          { name: 'database-without-clients', strategy: 'auth0' }, // No enabled_clients property
        ],
      };

      await handler.processChanges(assets);

      sinon.assert.calledOnce(processConnectionEnabledClientsStub);

      processConnectionEnabledClientsStub.restore();
    });
  });
});
