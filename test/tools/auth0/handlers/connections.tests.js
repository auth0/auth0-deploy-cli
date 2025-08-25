import pageClient from '../../../../src/tools/auth0/client';

/* eslint-disable consistent-return */
const { expect } = require('chai');
const sinon = require('sinon');
const connections = require('../../../../src/tools/auth0/handlers/connections');
const utils = require('../../../../src/tools/utils');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#connections handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#connections validate', () => {
    it('should not allow same names', async () => {
      const handler = new connections.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someConnection',
        },
        {
          name: 'someConnection',
        },
      ];

      try {
        await stageFn.apply(handler, [{ connections: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new connections.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someConnection',
        },
      ];

      await stageFn.apply(handler, [{ connections: data }]);
    });
  });

  describe('#connections process', () => {
    let scimHandlerMock;

    beforeEach(() => {
      scimHandlerMock = {
        createIdMap: sinon.stub().resolves(new Map()),
        getScimConfiguration: sinon.stub().resolves({
          connection_id: 'con_KYp633cmKtnEQ31C',
          connection_name: 'okta',
          strategy: 'okta',
          tenant_name: 'test-tenant',
          user_id_attribute: 'externalId-1',
          mapping: [
            {
              scim: 'scim_id',
              auth0: 'auth0_id',
            },
          ],
        }),
        applyScimConfiguration: sinon.stub().resolves(undefined),
        createOverride: sinon.stub().resolves(new Map()),
        updateOverride: sinon.stub().resolves(new Map()),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should create connection', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someConnection');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'connections', []),
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ connections: [{ name: 'someConnection' }] }]);
    });

    it('should get connections', async () => {
      const clientId = 'rFeR6vyzQcDEgSUsASPeF4tXr3xbZhxE';
      let getEnabledClientsCalledOnce = false;
      const auth0 = {
        connections: {
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', strategy: 'github', name: 'github', enabled_clients: [clientId] },
              { id: 'con2', strategy: 'auth0', name: 'db-should-be-ignored', enabled_clients: [] },
            ]),
          getEnabledClients: () => {
            getEnabledClientsCalledOnce = true;
            return Promise.resolve({
              data: {
                clients: [{ client_id: clientId }],
                next: null,
              },
            });
          },
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [{ name: 'test client', client_id: clientId }]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { id: 'con1', strategy: 'github', name: 'github', enabled_clients: [clientId] },
      ]);
      expect(getEnabledClientsCalledOnce).to.equal(true);
    });

    it('should update connection', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec'],
              options: { passwordPolicy: 'testPolicy' },
            });

            return Promise.resolve({ data: { ...params, ...data } });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { name: 'someConnection', id: 'con1', strategy: 'custom' },
            ]),
          _getRestClient: () => ({}),
          updateEnabledClients: (params) => {
            expect(params.id).to.equal('con1');
            return Promise.resolve({ data: [] });
          },
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom',
          enabled_clients: ['client1'],
          options: {
            passwordPolicy: 'testPolicy',
          },
        },
      ];

      await stageFn.apply(handler, [{ connections: data }]);
    });

    it('should convert client name with ID in idpinitiated.client_id', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.deep.equal({
              enabled_clients: ['YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec'],
              name: 'someConnection-2',
              strategy: 'custom',
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec',
                  client_protocol: 'samlp',
                  client_authorizequery: '',
                },
              },
            });
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec'],
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb',
                  client_protocol: 'samlp',
                  client_authorizequery: '',
                },
              },
            });

            return Promise.resolve({ data: { ...params, ...data } });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { name: 'someSamlConnection', id: 'con1', strategy: 'samlp' },
            ]),
          getEnabledClients: () => Promise.resolve({ data: [] }),
          updateEnabledClients: (params) => {
            expect(params.id).to.equal('con1');
            return Promise.resolve({ data: [] });
          },
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
              { name: 'idp-one', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb' },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      handler.scimHandler = scimHandlerMock;
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someSamlConnection',
          strategy: 'samlp',
          enabled_clients: ['client1'],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'idp-one',
              client_protocol: 'samlp',
              client_authorizequery: '',
            },
          },
        },
        {
          name: 'someConnection-2',
          strategy: 'custom',
          enabled_clients: ['client1'],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'client1',
              client_protocol: 'samlp',
              client_authorizequery: '',
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ connections: data }]);
    });

    it('should keep client ID in idpinitiated.client_id', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.deep.equal({
              enabled_clients: ['YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec'],
              name: 'someConnection-2',
              strategy: 'custom',
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Ted',
                  client_protocol: 'samlp',
                  client_authorizequery: '',
                },
              },
            });
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec'],
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb',
                  client_protocol: 'samlp',
                  client_authorizequery: '',
                },
              },
            });

            return Promise.resolve({ data: { ...params, ...data } });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { name: 'someSamlConnection', id: 'con1', strategy: 'samlp' },
            ]),
          _getRestClient: () => ({}),
          getEnabledClients: () => Promise.resolve({ data: [] }),
          updateEnabledClients: (params) => {
            expect(params.id).to.equal('con1');
            return Promise.resolve({ data: [] });
          },
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
              { name: 'idp-one', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb' },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      handler.scimHandler = scimHandlerMock;
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someSamlConnection',
          strategy: 'samlp',
          enabled_clients: ['client1'],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb',
              client_protocol: 'samlp',
              client_authorizequery: '',
            },
          },
        },
        {
          name: 'someConnection-2',
          strategy: 'custom',
          enabled_clients: ['client1'],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Ted',
              client_protocol: 'samlp',
              client_authorizequery: '',
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ connections: data }]);
    });

    // If client is excluded and in the existing connection this client is enabled, it should keep enabled
    // If client is excluded and in the existing connection this client is disabled, it should keep disabled
    it('should handle excluded clients properly', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve({ data });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['client1-id', 'excluded-one-id'],
              options: { passwordPolicy: 'testPolicy' },
            });

            return Promise.resolve({ data: { ...params, ...data } });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              {
                name: 'someConnection',
                id: 'con1',
                strategy: 'custom',
                enabled_clients: ['excluded-one-id'],
              },
            ]),
          _getRestClient: () => ({}),
          getEnabledClients: () => Promise.resolve({ data: [] }),
          updateEnabledClients: (params) => {
            expect(params.id).to.equal('con1');
            return Promise.resolve({ data: [] });
          },
        },
        clients: {
          getAll: (params) =>
            mockPagedData(params, 'clients', [
              { name: 'client1', client_id: 'client1-id' },
              { name: 'excluded-one', client_id: 'excluded-one-id' },
              { name: 'excluded-two', client_id: 'excluded-two-id' },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom',
          enabled_clients: ['client1', 'excluded-one', 'excluded-two'],
          options: {
            passwordPolicy: 'testPolicy',
          },
        },
      ];

      await stageFn.apply(handler, [
        { connections: data, exclude: { clients: ['excluded-one', 'excluded-two'] } },
      ]);
    });

    it('should delete connection and create another one instead', async () => {
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someConnection');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');

            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'custom' },
            ]),
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom',
        },
      ];

      await stageFn.apply(handler, [{ connections: data }]);
    });

    it('should delete all connections', async () => {
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
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'custom' },
            ]),
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ connections: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        connections: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'custom' },
            ]),
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom',
        },
      ];

      await stageFn.apply(handler, [{ connections: data }]);
    });

    it('should not remove connections if run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret',
      };
      const auth0 = {
        connections: {
          create: () => Promise.resolve({ data: undefined }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existingConnection', strategy: 'custom' },
            ]),
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ connections: [] }]);
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
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'con1', name: 'existing1', strategy: 'custom' },
              { id: 'con2', name: 'existing2', strategy: 'custom' },
            ]),
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: (params) => mockPagedData(params, 'clients', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const assets = {
        exclude: {
          connections: ['existing1', 'existing2', 'existing3'],
        },
        connections: [{ name: 'existing3', strategy: 'custom' }],
      };

      await stageFn.apply(handler, [assets]);
    });
  });
});

describe('#connections enabled clients functionality', () => {
  const {
    getConnectionEnabledClients,
    updateConnectionEnabledClients,
    processConnectionEnabledClients,
  } = connections;

  let mockAuth0Client;

  beforeEach(() => {
    // Mock Auth0 client
    mockAuth0Client = {
      connections: {
        getEnabledClients: sinon.stub(),
        updateEnabledClients: sinon.stub(),
        getAll: sinon.stub(),
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#getConnectionEnabledClients', () => {
    it('should return array of client IDs with single page', async () => {
      const connectionId = 'con_123';
      const mockResponse = {
        data: {
          clients: [
            { client_id: 'client_1' },
            { client_id: 'client_2' },
            { client_id: 'client_3' },
          ],
          next: null,
        },
      };

      mockAuth0Client.connections.getEnabledClients.resolves(mockResponse);

      const result = await getConnectionEnabledClients(mockAuth0Client, connectionId);

      expect(result).to.deep.equal(['client_1', 'client_2', 'client_3']);
      sinon.assert.calledOnceWithExactly(mockAuth0Client.connections.getEnabledClients, {
        id: connectionId,
        take: 50,
      });
    });

    it('should return empty array when no enabled clients', async () => {
      const connectionId = 'con_123';
      const mockResponse = {
        data: {
          clients: [],
          next: null,
        },
      };

      mockAuth0Client.connections.getEnabledClients.resolves(mockResponse);

      const result = await getConnectionEnabledClients(mockAuth0Client, connectionId);

      expect(result).to.deep.equal([]);
    });
  });

  describe('#updateConnectionEnabledClients', () => {
    it('should update enabled clients successfully', async () => {
      const connectionId = 'con_123';
      const enabledClientIds = ['client_1', 'client_2', 'client_3'];
      const typeName = 'connection';

      mockAuth0Client.connections.updateEnabledClients.resolves();

      const result = await updateConnectionEnabledClients(
        mockAuth0Client,
        typeName,
        connectionId,
        enabledClientIds
      );

      expect(result).to.equal(true);
      sinon.assert.calledOnceWithExactly(
        mockAuth0Client.connections.updateEnabledClients,
        { id: connectionId },
        [
          { client_id: 'client_1', status: true },
          { client_id: 'client_2', status: true },
          { client_id: 'client_3', status: true },
        ]
      );
    });

    it('should update enabled clients with more than 50 clients', async () => {
      const connectionId = 'con_123';
      const enabledClientIds = Array.from({ length: 60 }, (_, i) => `client_${i + 1}`);
      const typeName = 'connection';

      mockAuth0Client.connections.updateEnabledClients.resolves();

      const result = await updateConnectionEnabledClients(
        mockAuth0Client,
        typeName,
        connectionId,
        enabledClientIds
      );

      expect(result).to.equal(true);
      sinon.assert.calledTwice(mockAuth0Client.connections.updateEnabledClients);

      const firstCall = mockAuth0Client.connections.updateEnabledClients.getCall(0);
      expect(firstCall.args[0]).to.deep.equal({ id: connectionId });
      expect(firstCall.args[1]).to.have.length(50);
      expect(firstCall.args[1][0]).to.deep.equal({ client_id: 'client_1', status: true });
      expect(firstCall.args[1][49]).to.deep.equal({ client_id: 'client_50', status: true });

      const secondCall = mockAuth0Client.connections.updateEnabledClients.getCall(1);
      expect(secondCall.args[0]).to.deep.equal({ id: connectionId });
      expect(secondCall.args[1]).to.have.length(10);
      expect(secondCall.args[1][0]).to.deep.equal({ client_id: 'client_51', status: true });
      expect(secondCall.args[1][9]).to.deep.equal({ client_id: 'client_60', status: true });
    });
  });

  describe('#processConnectionEnabledClients', () => {
    let sleepStub;

    beforeEach(() => {
      // Mock the sleep function
      sleepStub = sinon.stub(utils, 'sleep').resolves();
    });

    it('should process create operations with ID lookup', async () => {
      const typeName = 'connection';
      const changes = {
        create: [
          { name: 'new-connection-1', enabled_clients: ['client_1', 'client_2'] },
          { name: 'new-connection-2', enabled_clients: ['client_3'] },
        ],
        update: [],
        conflicts: [],
      };

      // Mock getAll to return newly created connections
      mockAuth0Client.connections.getAll
        .onFirstCall()
        .resolves({
          data: {
            connections: [{ id: 'con_new_1', name: 'new-connection-1' }],
          },
        })
        .onSecondCall()
        .resolves({
          data: {
            connections: [{ id: 'con_new_2', name: 'new-connection-2' }],
          },
        });

      // Mock updateEnabledClients
      mockAuth0Client.connections.updateEnabledClients.resolves();

      await processConnectionEnabledClients(mockAuth0Client, typeName, changes);

      sinon.assert.calledOnceWithExactly(sleepStub, 2500);
      sinon.assert.calledTwice(mockAuth0Client.connections.getAll);
      sinon.assert.calledTwice(mockAuth0Client.connections.updateEnabledClients);
    });

    it('should process update operations', async () => {
      const typeName = 'connection';
      const changes = {
        create: [],
        update: [
          { id: 'con_1', name: 'existing-connection-1', enabled_clients: ['client_1', 'client_2'] },
          { id: 'con_2', name: 'existing-connection-2', enabled_clients: ['client_3'] },
        ],
        conflicts: [],
      };

      mockAuth0Client.connections.updateEnabledClients.resolves();

      await processConnectionEnabledClients(mockAuth0Client, typeName, changes);

      sinon.assert.notCalled(sleepStub);
      sinon.assert.calledTwice(mockAuth0Client.connections.updateEnabledClients);
    });

    it('should process conflict operations', async () => {
      const typeName = 'connection';
      const changes = {
        create: [],
        update: [],
        conflicts: [{ id: 'con_1', name: 'conflict-connection-1', enabled_clients: ['client_1'] }],
      };

      mockAuth0Client.connections.updateEnabledClients.resolves();

      await processConnectionEnabledClients(mockAuth0Client, typeName, changes);

      sinon.assert.calledOnce(mockAuth0Client.connections.updateEnabledClients);
    });

    it('should handle database type connections differently', async () => {
      const typeName = 'database';
      const changes = {
        create: [{ name: 'new-db-connection', enabled_clients: ['client_1'] }],
        update: [],
        conflicts: [],
      };

      mockAuth0Client.connections.getAll.resolves({
        data: {
          connections: [{ id: 'con_db_1', name: 'new-db-connection' }],
        },
      });
      mockAuth0Client.connections.updateEnabledClients.resolves();

      await processConnectionEnabledClients(mockAuth0Client, typeName, changes);

      sinon.assert.calledWith(mockAuth0Client.connections.getAll, {
        name: 'new-db-connection',
        take: 1,
        strategy: ['auth0'],
        include_totals: true,
      });
    });
  });

  describe('#connections handler with enabled clients integration', () => {
    const config = function (key) {
      return config.data && config.data[key];
    };

    config.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    let scimHandlerMock;

    beforeEach(() => {
      scimHandlerMock = {
        createIdMap: sinon.stub().resolves(new Map()),
        getScimConfiguration: sinon.stub().resolves({}),
        applyScimConfiguration: sinon.stub().resolves(undefined),
        createOverride: sinon.stub().resolves(new Map()),
        updateOverride: sinon.stub().resolves(new Map()),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('#getType with enabled clients', () => {
      it('should fetch and include enabled clients in connection data', async () => {
        const auth0 = {
          connections: {
            getAll: (params) =>
              mockPagedData(params, 'connections', [
                { id: 'con_1', strategy: 'github', name: 'github-connection' },
                { id: 'con_2', strategy: 'google', name: 'google-connection' },
                { strategy: 'auth0', name: 'db-should-be-ignored' }, // Should be filtered out
              ]),
            getEnabledClients: sinon.stub(),
            _getRestClient: () => ({}),
          },
          clients: {
            getAll: (params) => mockPagedData(params, 'clients', []),
          },
          pool,
        };

        // Mock enabled clients responses
        auth0.connections.getEnabledClients
          .withArgs({ id: 'con_1', take: 50 })
          .resolves({
            data: {
              clients: [{ client_id: 'client_1' }, { client_id: 'client_2' }],
              next: null,
            },
          })
          .withArgs({ id: 'con_2', take: 50 })
          .resolves({
            data: {
              clients: [{ client_id: 'client_3' }],
              next: null,
            },
          });

        const handler = new connections.default({ client: pageClient(auth0), config });
        handler.scimHandler = scimHandlerMock;

        const result = await handler.getType();

        expect(result).to.have.length(2);
        expect(result[0]).to.include({
          id: 'con_1',
          strategy: 'github',
          name: 'github-connection',
        });
        expect(result[0].enabled_clients).to.deep.equal(['client_1', 'client_2']);
        expect(result[1]).to.include({
          id: 'con_2',
          strategy: 'google',
          name: 'google-connection',
        });
        expect(result[1].enabled_clients).to.deep.equal(['client_3']);
      });

      it('should handle connections without enabled clients', async () => {
        const auth0 = {
          connections: {
            getAll: (params) =>
              mockPagedData(params, 'connections', [
                { id: 'con_1', strategy: 'github', name: 'github-connection' },
              ]),
            getEnabledClients: sinon.stub(),
            _getRestClient: () => ({}),
          },
          clients: {
            getAll: (params) => mockPagedData(params, 'clients', []),
          },
          pool,
        };

        // Mock empty enabled clients response
        auth0.connections.getEnabledClients.resolves({
          data: {
            clients: [],
            next: null,
          },
        });

        const handler = new connections.default({ client: pageClient(auth0), config });
        handler.scimHandler = scimHandlerMock;

        const result = await handler.getType();

        expect(result).to.have.length(1);
        expect(result[0]).to.not.have.property('enabled_clients');
      });
    });

    describe('#processChanges with enabled clients', () => {
      it('should call processConnectionEnabledClients after super.processChanges', async () => {
        const processConnectionEnabledClientsStub = sinon
          .stub(connections, 'processConnectionEnabledClients')
          .resolves();

        const auth0 = {
          connections: {
            create: sinon.stub().resolves({ data: {} }),
            update: sinon.stub().resolves({ data: {} }),
            delete: sinon.stub().resolves({ data: {} }),
            getAll: (params) => mockPagedData(params, 'connections', []),
            _getRestClient: () => ({}),
          },
          clients: {
            getAll: (params) => mockPagedData(params, 'clients', []),
          },
          pool,
        };

        const handler = new connections.default({ client: pageClient(auth0), config });
        handler.scimHandler = scimHandlerMock;

        const assets = {
          connections: [
            { name: 'test-connection', strategy: 'custom', enabled_clients: ['client_1'] },
          ],
        };

        await handler.processChanges(assets);

        sinon.assert.calledOnce(processConnectionEnabledClientsStub);
        expect(processConnectionEnabledClientsStub.firstCall.args[0]).to.equal(handler.client);
        expect(processConnectionEnabledClientsStub.firstCall.args[1]).to.equal(handler.type);

        processConnectionEnabledClientsStub.restore();
      });

      it('should respect excluded connections in enabled clients processing', async () => {
        const processConnectionEnabledClientsStub = sinon
          .stub(connections, 'processConnectionEnabledClients')
          .resolves();

        const auth0 = {
          connections: {
            create: sinon.stub().resolves({ data: {} }),
            update: sinon.stub().resolves({ data: {} }),
            delete: sinon.stub().resolves({ data: {} }),
            getAll: (params) => mockPagedData(params, 'connections', []),
            _getRestClient: () => ({}),
          },
          clients: {
            getAll: (params) => mockPagedData(params, 'clients', []),
          },
          pool,
        };

        const handler = new connections.default({ client: pageClient(auth0), config });
        handler.scimHandler = scimHandlerMock;

        const assets = {
          connections: [
            { name: 'included-connection', strategy: 'custom', enabled_clients: ['client_1'] },
            { name: 'excluded-connection', strategy: 'custom', enabled_clients: ['client_2'] },
          ],
          exclude: {
            connections: ['excluded-connection'],
          },
        };

        await handler.processChanges(assets);

        sinon.assert.calledOnce(processConnectionEnabledClientsStub);

        // Verify that excluded connections are filtered out
        const passedChanges = processConnectionEnabledClientsStub.firstCall.args[2];
        expect(passedChanges.create).to.be.an('array');
        expect(passedChanges.update).to.be.an('array');
        expect(passedChanges.conflicts).to.be.an('array');

        processConnectionEnabledClientsStub.restore();
      });
    });
  });
});

describe('#addExcludedConnectionPropertiesToChanges', () => {
  const { addExcludedConnectionPropertiesToChanges } = connections;

  const mockConnsWithoutExcludedProps = [
    {
      id: 'con_1',
      name: 'connection-1',
      options: {
        domain: 'login.auth0.net',
      },
      enabled_clients: ['client_1', 'client_2'],
      shouldHaveExcludedProps: true, // Not a real connection property, just helps testing
    },
    {
      id: 'con_2',
      name: 'connection-2',
      options: {
        domain: 'enterprise-login.auth0.net',
      },
      enabled_clients: ['client_1'],
      shouldHaveExcludedProps: false, // Not a real connection property, just helps testing
    },
    {
      id: 'con_3',
      name: 'connection-3',
      options: {
        domain: 'login.azure-prod-us.net',
      },
      enabled_clients: ['client_1', 'client_3'],
      shouldHaveExcludedProps: true, // Not a real connection property, just helps testing
    },
  ];

  const mockConnsWithExcludedProps = mockConnsWithoutExcludedProps.map((conn) => {
    if (!conn.shouldHaveExcludedProps) return conn;
    return {
      ...conn,
      options: {
        ...conn.options,
        client_id: `${conn.id}-client-id`,
        client_secret: `${conn.id}-client-secret`,
      },
    };
  });

  const proposedChanges = {
    del: [],
    update: mockConnsWithoutExcludedProps,
    create: [],
  };

  const existingConnections = mockConnsWithExcludedProps;

  const config = () => ({
    EXCLUDED_PROPS: {
      tenant: ['some-unrelated-excluded-property'],
      connections: ['options.client_id', 'options.client_secret'],
    },
  });

  it('should add excluded properties into connections update payload', () => {
    const updatedProposedChanges = addExcludedConnectionPropertiesToChanges({
      config,
      existingConnections,
      proposedChanges,
    });
    expect(updatedProposedChanges.update).to.lengthOf(proposedChanges.update.length);
    // Loop through proposed changes and expect to see connections that should have excluded properties to have them
    updatedProposedChanges.update.forEach((change, i) => {
      if (!change.shouldHaveExcludedProps) {
        return expect(change).to.deep.equal(mockConnsWithoutExcludedProps[i]);
      }
      expect(change).to.deep.equal(mockConnsWithExcludedProps[i]);
    });
  });

  it('should add entire excluded options object into connections update payload', () => {
    const updatedProposedChanges = addExcludedConnectionPropertiesToChanges({
      config: () => ({
        EXCLUDED_PROPS: {
          connections: ['options'],
        },
      }),
      existingConnections,
      proposedChanges,
    });
    expect(updatedProposedChanges.update).to.lengthOf(proposedChanges.update.length);
    // Loop through proposed changes and expect to see connections that should have excluded properties to have them
    updatedProposedChanges.update.forEach((change, i) => {
      if (!change.shouldHaveExcludedProps) {
        return expect(change).to.deep.equal(mockConnsWithoutExcludedProps[i]);
      }
      expect(change).to.deep.equal(mockConnsWithExcludedProps[i]);
    });
  });

  it('should not modify update payload if no excluded properties exist', () => {
    const updatedProposedChangesNoConfig = addExcludedConnectionPropertiesToChanges({
      config: () => ({}),
      existingConnections,
      proposedChanges,
    });

    expect(updatedProposedChangesNoConfig).to.deep.equal(proposedChanges); // Expect no change
  });

  it('should not modify update payload if only unrelated excluded properties exist', () => {
    const updatedProposedChangesUnrelatedConfig = addExcludedConnectionPropertiesToChanges({
      config: () => ({
        EXCLUDED_PROPS: {
          connections: ['some-unrelated-property-1', 'options.some-unrelated-property-2'],
          tenant: ['some-unrelated-property-3'],
        },
      }),
      existingConnections,
      proposedChanges,
    });
    expect(updatedProposedChangesUnrelatedConfig).to.deep.equal(proposedChanges); // Expect no change
  });

  it('should not modify update payload if no updates are proposed', () => {
    const updatedProposedChangesUnrelatedConfig = addExcludedConnectionPropertiesToChanges({
      config,
      existingConnections,
      proposedChanges: {
        ...proposedChanges,
        update: [], // Override to have no proposed updates
      },
    });
    expect(updatedProposedChangesUnrelatedConfig).to.deep.equal({
      create: [],
      del: [],
      update: [],
    }); // Expect no change
  });

  describe('#connections dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return create changes for new connections', async () => {
      const auth0 = {
        connections: {
          getAll: (params) => mockPagedData(params, 'connections', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        connections: [
          { name: 'New Connection 1', strategy: 'auth0' },
          { name: 'New Connection 2', strategy: 'google-oauth2' },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(2);
      expect(changes.create[0]).to.include({ name: 'New Connection 1', strategy: 'auth0' });
      expect(changes.create[1]).to.include({ name: 'New Connection 2', strategy: 'google-oauth2' });
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return update changes for existing connections with differences', async () => {
      const auth0 = {
        connections: {
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              {
                id: 'conn1',
                name: 'Existing Connection',
                strategy: 'google-oauth2',
                enabled_clients: ['client1'],
              },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        connections: [
          {
            name: 'Existing Connection',
            strategy: 'google-oauth2',
            enabled_clients: ['client1', 'client2'],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.update[0]).to.include({
        name: 'Existing Connection',
        strategy: 'google-oauth2',
        id: 'conn1',
      });
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for connections not in assets', async () => {
      const auth0 = {
        connections: {
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              { id: 'conn1', name: 'Connection To Remove', strategy: 'google-oauth2' },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = { connections: [] };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(1);
      expect(changes.del[0]).to.include({
        id: 'conn1',
        name: 'Connection To Remove',
        strategy: 'google-oauth2',
      });
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when connections are identical', async () => {
      const auth0 = {
        connections: {
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              {
                id: 'conn1',
                name: 'Unchanged Connection',
                strategy: 'google-oauth2',
                enabled_clients: ['client1'],
              },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        connections: [
          {
            name: 'Unchanged Connection',
            strategy: 'google-oauth2',
            enabled_clients: ['client1'],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle mixed create, update, and delete operations', async () => {
      const auth0 = {
        connections: {
          getAll: (params) =>
            mockPagedData(params, 'connections', [
              {
                id: 'conn1',
                name: 'Update Connection',
                strategy: 'google-oauth2',
                enabled_clients: ['client1'],
              },
              { id: 'conn2', name: 'Delete Connection', strategy: 'google-oauth2' },
            ]),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        connections: [
          {
            name: 'Update Connection',
            strategy: 'google-oauth2',
            enabled_clients: ['client1', 'client2'],
          },
          { name: 'Create Connection', strategy: 'facebook' },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create.length).to.be.greaterThan(0);
      expect(changes.update.length).to.be.greaterThan(0);
      expect(changes.del.length).to.be.greaterThan(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const auth0 = {
        connections: {
          getAll: (params) => mockPagedData(params, 'connections', []),
        },
        pool,
      };

      const handler = new connections.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {}; // No connections property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
