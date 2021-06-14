const { expect } = require('chai');
const connections = require('../../../../src/tools/auth0/handlers/connections');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  }
};

describe('#connections handler', () => {
  const config = function(key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true
  };

  describe('#connections validate', () => {
    it('should not allow same names', async () => {
      const handler = new connections.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someConnection'
        },
        {
          name: 'someConnection'
        }
      ];

      try {
        await stageFn.apply(handler, [ { connections: data } ]);
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
          name: 'someConnection'
        }
      ];

      await stageFn.apply(handler, [ { connections: data } ]);
    });
  });

  describe('#connections process', () => {
    it('should create connection', async () => {
      const auth0 = {
        connections: {
          create: (data) => {
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someConnection');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          getAll: () => []
        },
        clients: {
          getAll: () => []
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { connections: [ { name: 'someConnection' } ] } ]);
    });

    it('should get connections', async () => {
      const clientId = 'rFeR6vyzQcDEgSUsASPeF4tXr3xbZhxE';

      const auth0 = {
        connections: {
          getAll: () => [
            { strategy: 'github', name: 'github', enabled_clients: [ clientId ] },
            { strategy: 'auth0', name: 'db-should-be-ignored', enabled_clients: [] }
          ]
        },
        clients: {
          getAll: () => [
            { name: 'test client', client_id: clientId }
          ]
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([ { strategy: 'github', name: 'github', enabled_clients: [ clientId ] } ]);
    });

    it('should update connection', async () => {
      const auth0 = {
        connections: {
          create: (data) => {
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: (params, data) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: [ 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' ],
              options: { passwordPolicy: 'testPolicy' }
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [ { name: 'someConnection', id: 'con1', strategy: 'custom' } ]
        },
        clients: {
          getAll: () => [ { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' } ]
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom',
          enabled_clients: [ 'client1' ],
          options: {
            passwordPolicy: 'testPolicy'
          }
        }
      ];

      await stageFn.apply(handler, [ { connections: data } ]);
    });

    it('should convert client name with ID in idpinitiated.client_id', async () => {
      const auth0 = {
        connections: {
          create: (data) => {
            expect(data).to.deep.equal({
              enabled_clients: [ 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' ],
              name: 'someConnection-2',
              strategy: 'custom',
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec',
                  client_protocol: 'samlp',
                  client_authorizequery: ''
                }
              }
            });
            return Promise.resolve(data);
          },
          update: (params, data) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: [ 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' ],
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb',
                  client_protocol: 'samlp',
                  client_authorizequery: ''
                }
              }
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [
            { name: 'someSamlConnection', id: 'con1', strategy: 'samlp' }
          ]
        },
        clients: {
          getAll: () => [
            { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
            { name: 'idp-one', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb' }
          ]
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someSamlConnection',
          strategy: 'samlp',
          enabled_clients: [ 'client1' ],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'idp-one',
              client_protocol: 'samlp',
              client_authorizequery: ''
            }
          }
        },
        {
          name: 'someConnection-2',
          strategy: 'custom',
          enabled_clients: [ 'client1' ],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'client1',
              client_protocol: 'samlp',
              client_authorizequery: ''
            }
          }
        }
      ];

      await stageFn.apply(handler, [ { connections: data } ]);
    });

    it('should keep client ID in idpinitiated.client_id', async () => {
      const auth0 = {
        connections: {
          create: (data) => {
            expect(data).to.deep.equal({
              enabled_clients: [ 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' ],
              name: 'someConnection-2',
              strategy: 'custom',
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Ted',
                  client_protocol: 'samlp',
                  client_authorizequery: ''
                }
              }
            });
            return Promise.resolve(data);
          },
          update: (params, data) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: [ 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' ],
              options: {
                passwordPolicy: 'testPolicy',
                idpinitiated: {
                  client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb',
                  client_protocol: 'samlp',
                  client_authorizequery: ''
                }
              }
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [
            { name: 'someSamlConnection', id: 'con1', strategy: 'samlp' }
          ]
        },
        clients: {
          getAll: () => [
            { name: 'client1', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Tec' },
            { name: 'idp-one', client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb' }
          ]
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someSamlConnection',
          strategy: 'samlp',
          enabled_clients: [ 'client1' ],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Teb',
              client_protocol: 'samlp',
              client_authorizequery: ''
            }
          }
        },
        {
          name: 'someConnection-2',
          strategy: 'custom',
          enabled_clients: [ 'client1' ],
          options: {
            passwordPolicy: 'testPolicy',
            idpinitiated: {
              client_id: 'YwqVtt8W3pw5AuEz3B2Kse9l2Ruy7Ted',
              client_protocol: 'samlp',
              client_authorizequery: ''
            }
          }
        }
      ];

      await stageFn.apply(handler, [ { connections: data } ]);
    });

    // If client is excluded and in the existing connection this client is enabled, it should keep enabled
    // If client is excluded and in the existing connection this client is disabled, it should keep disabled
    it('should handle excluded clients properly', async () => {
      const auth0 = {
        connections: {
          create: (data) => {
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          update: (params, data) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            expect(data).to.deep.equal({
              enabled_clients: [ 'client1-id', 'excluded-one-id' ],
              options: { passwordPolicy: 'testPolicy' }
            });

            return Promise.resolve({ ...params, ...data });
          },
          delete: () => Promise.resolve([]),
          getAll: () => [ {
            name: 'someConnection', id: 'con1', strategy: 'custom', enabled_clients: [ 'excluded-one-id' ]
          } ]
        },
        clients: {
          getAll: () => [
            { name: 'client1', client_id: 'client1-id' },
            { name: 'excluded-one', client_id: 'excluded-one-id' },
            { name: 'excluded-two', client_id: 'excluded-two-id' }
          ]
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom',
          enabled_clients: [ 'client1', 'excluded-one', 'excluded-two' ],
          options: {
            passwordPolicy: 'testPolicy'
          }
        }
      ];

      await stageFn.apply(handler, [ { connections: data, exclude: { clients: [ 'excluded-one', 'excluded-two' ] } } ]);
    });

    it('should delete connection and create another one instead', async () => {
      const auth0 = {
        connections: {
          create: (data) => {
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someConnection');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');

            return Promise.resolve([]);
          },
          getAll: () => [ { id: 'con1', name: 'existingConnection', strategy: 'custom' } ]
        },
        clients: {
          getAll: () => []
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom'
        }
      ];

      await stageFn.apply(handler, [ { connections: data } ]);
    });

    it('should delete all connections', async () => {
      let removed = false;
      const auth0 = {
        connections: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.equal('con1');
            removed = true;
            return Promise.resolve([]);
          },
          getAll: () => [ { id: 'con1', name: 'existingConnection', strategy: 'custom' } ]
        },
        clients: {
          getAll: () => []
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { connections: [] } ]);
      expect(removed).to.equal(true);
    });

    it('should not remove if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        connections: {
          create: (data) => Promise.resolve(data),
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [ { id: 'con1', name: 'existingConnection', strategy: 'custom' } ]
        },
        clients: {
          getAll: () => []
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = [
        {
          name: 'someConnection',
          strategy: 'custom'
        }
      ];

      await stageFn.apply(handler, [ { connections: data } ]);
    });

    it('should not remove connections if run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret'
      };
      const auth0 = {
        connections: {
          create: () => Promise.resolve(),
          update: () => Promise.resolve([]),
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [ { id: 'con1', name: 'existingConnection', strategy: 'custom' } ]
        },
        clients: {
          getAll: () => []
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { connections: [] } ]);
    });

    it('should not remove/create/update excluded connections', async () => {
      config.data = {
        EXTENSION_SECRET: false,
        AUTH0_ALLOW_DELETE: true
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
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          getAll: () => [
            { id: 'con1', name: 'existing1', strategy: 'custom' },
            { id: 'con2', name: 'existing2', strategy: 'custom' }
          ]
        },
        clients: {
          getAll: () => []
        },
        pool
      };

      const handler = new connections.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const assets = {
        exclude: {
          connections: [ 'existing1', 'existing2', 'existing3' ]
        },
        connections: [ { name: 'existing3', strategy: 'custom' } ]
      };

      await stageFn.apply(handler, [ assets ]);
    });
  });
});
