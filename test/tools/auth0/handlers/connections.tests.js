/* eslint-disable consistent-return */
const { expect } = require('chai');
const sinon = require('sinon');
const connections = require('../../../../src/tools/auth0/handlers/connections');

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
              auth0: 'auth0_id'
            }
          ]
        }),
        applyScimConfiguration: sinon.stub().resolves(undefined)
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
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          getAll: () => [],
          _getRestClient: (path) => ({}),
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ connections: [{ name: 'someConnection' }] }]);
    });

    it('should get connections', async () => {
      const clientId = 'rFeR6vyzQcDEgSUsASPeF4tXr3xbZhxE';

      const auth0 = {
        connections: {
          getAll: () => [
            { strategy: 'github', name: 'github', enabled_clients: [clientId] },
            { strategy: 'auth0', name: 'db-should-be-ignored', enabled_clients: [] },
          ],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [{ name: 'test client', client_id: clientId }],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { strategy: 'github', name: 'github', enabled_clients: [clientId] },
      ]);
    });

    it('should update connection', async () => {
      const auth0 = {
        connections: {
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
              options: { passwordPolicy: 'testPolicy' },
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [{ name: 'someConnection', id: 'con1', strategy: 'custom' }],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [{ name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' }],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
            return Promise.resolve(data);
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

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [{ name: 'someSamlConnection', id: 'con1', strategy: 'samlp' }],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [
            { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
            { name: 'idp-one', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb' },
          ],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
            return Promise.resolve(data);
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

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [{ name: 'someSamlConnection', id: 'con1', strategy: 'samlp' }],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [
            { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
            { name: 'idp-one', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb' },
          ],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
            return Promise.resolve(data);
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: ['client1-id', 'excluded-one-id'],
              options: { passwordPolicy: 'testPolicy' },
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [
            {
              name: 'someConnection',
              id: 'con1',
              strategy: 'custom',
              enabled_clients: ['excluded-one-id'],
            },
          ],
          _getRestClient: () => ({}),
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

      const handler = new connections.default({ client: auth0, config });
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
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');

            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'custom' }],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            removed = true;
            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'custom' }],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'custom' }],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
          create: () => Promise.resolve(),
          update: () => Promise.resolve([]),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [{ id: 'con1', name: 'existingConnection', strategy: 'custom' }],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
            { id: 'con1', name: 'existing1', strategy: 'custom' },
            { id: 'con2', name: 'existing2', strategy: 'custom' },
          ],
          _getRestClient: () => ({}),
        },
        clients: {
          getAll: () => [],
        },
        pool,
      };

      const handler = new connections.default({ client: auth0, config });
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
});
