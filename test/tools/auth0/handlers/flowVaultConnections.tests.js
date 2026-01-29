import { PromisePoolExecutor } from 'promise-pool-executor';
import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const flowVaultConnections = require('../../../../src/tools/auth0/handlers/flowVaultConnections');
const { mockPagedData } = require('../../../utils');

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleFlowVaultConnections = {
  id: 'ac_9AXxPP59pJx5ZtA471cSAy',
  name: 'Sample Connection',
  app_id: 'HTTP',
  account_name: 'Sample Account name',
  ready: false,
};

describe('#flowVaultConnections handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#flowVaultConnections validate', () => {
    it('should not allow same names', async () => {
      const handler = new flowVaultConnections.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-flow-connection',
        },
        {
          name: 'some-flow-connection',
        },
      ];

      try {
        await stageFn.apply(handler, [{ flowVaultConnections: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new flowVaultConnections.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-flow-connection',
        },
      ];

      await stageFn.apply(handler, [{ clients: data }]);
    });
  });

  describe('#flowVaultConnections process', () => {
    it('should return empty if no flowVaultConnections asset', async () => {
      const auth0 = {
        flows: {
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create flowVaultConnections', async () => {
      const auth0 = {
        flows: {
          vault: {
            connections: {
              create: function (data) {
                (() => expect(this).to.not.be.undefined)();
                expect(data).to.be.an('object');
                expect(data.name).to.equal(sampleFlowVaultConnections.name);
                return Promise.resolve(data);
              },
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          flowVaultConnections: [sampleFlowVaultConnections],
        },
      ]);
    });

    it('should get flowVaultConnections', async () => {
      const auth0 = {
        flows: {
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', [sampleFlowVaultConnections]),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleFlowVaultConnections]);
    });

    it('should handle multi-page pagination for flowVaultConnections', async () => {
      // Simulate 3 pages of flow vault connections
      const page1 = [
        { id: 'ac_1', name: 'Connection 1', app_id: 'HTTP' },
        { id: 'ac_2', name: 'Connection 2', app_id: 'HTTP' },
      ];
      const page2 = [{ id: 'ac_3', name: 'Connection 3', app_id: 'HTTP' }];
      const page3 = [
        { id: 'ac_4', name: 'Connection 4', app_id: 'HTTP' },
        { id: 'ac_5', name: 'Connection 5', app_id: 'HTTP' },
      ];

      const auth0 = {
        flows: {
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', page1, [page2, page3]),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      // Should include connections from ALL 3 pages
      expect(data).to.have.length(5);
      expect(data.map((c) => c.id)).to.deep.equal(['ac_1', 'ac_2', 'ac_3', 'ac_4', 'ac_5']);
    });

    it('should update flowVaultConnections', async () => {
      const auth0 = {
        flows: {
          vault: {
            connections: {
              update: function (id, data) {
                (() => expect(this).to.not.be.undefined)();
                expect(id).to.be.a('string');
                expect(id).to.equal(sampleFlowVaultConnections.id);
                expect(data).to.be.an('object');
                expect(data.name).to.equal(sampleFlowVaultConnections.name);
                return Promise.resolve(data);
              },
              list: (params) => mockPagedData(params, 'connections', [sampleFlowVaultConnections]),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          flowVaultConnections: [sampleFlowVaultConnections],
        },
      ]);
    });

    it('should delete flowVaultConnections and create another one instead', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;

      const newFlowConnection = {
        name: sampleFlowVaultConnections.name + ' new',
      };
      const auth0 = {
        flows: {
          vault: {
            connections: {
              create: function (data) {
                (() => expect(this).to.not.be.undefined)();
                expect(data).to.be.an('object');
                expect(data.name).to.equal(newFlowConnection.name);
                return Promise.resolve(data);
              },
              delete: function (id) {
                (() => expect(this).to.not.be.undefined)();
                expect(id).to.be.a('string');
                expect(id).to.equal(sampleFlowVaultConnections.id);
                return Promise.resolve([]);
              },
              list: (params) => mockPagedData(params, 'connections', [sampleFlowVaultConnections]),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ flowVaultConnections: [newFlowConnection] }]);
    });

    it('should delete all flowVaultConnections', async () => {
      let removed = false;
      const auth0 = {
        flows: {
          vault: {
            connections: {
              delete: function (id) {
                removed = true;
                (() => expect(this).to.not.be.undefined)();
                expect(id).to.be.a('string');
                expect(id).to.equal(sampleFlowVaultConnections.id);
                return Promise.resolve([]);
              },
              list: (params) => mockPagedData(params, 'connections', [sampleFlowVaultConnections]),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ flowVaultConnections: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove flowVaultConnections if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        flows: {
          vault: {
            connections: {
              delete: (id) => {
                expect(id).to.be.an('undefined');
                return Promise.resolve([]);
              },
              list: (params) => mockPagedData(params, 'connections', [sampleFlowVaultConnections]),
            },
          },
        },
        pool,
      };

      const handler = new flowVaultConnections.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ flowVaultConnections: [] }]);
    });
  });
});
