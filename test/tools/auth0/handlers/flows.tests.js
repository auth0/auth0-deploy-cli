import { PromisePoolExecutor } from 'promise-pool-executor';
import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const flows = require('../../../../src/tools/auth0/handlers/flows');
const { mockPagedData } = require('../../../utils');

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleFlowWthID = {
  name: 'sample flow 1',
  id: 'af_9AXxPP59pJx5ZtA471cSAy',
};

const sampleConnectionWithID = {
  name: 'Sample Connection',
  id: 'ac_9AXxPP59pJx5ZtA471cSAy',
};

describe('#flows handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#flows validate', () => {
    it('should not allow same names', async () => {
      const handler = new flows.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-flow',
        },
        {
          name: 'some-flow',
        },
      ];

      try {
        await stageFn.apply(handler, [{ flows: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new flows.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-flow',
        },
      ];

      await stageFn.apply(handler, [{ clients: data }]);
    });
  });

  describe('#flows process', () => {
    it('should return empty if no flows asset', async () => {
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

      const handler = new flows.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create flows', async () => {
      const auth0 = {
        flows: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleFlowWthID.name);
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'flows', []),
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          flows: [sampleFlowWthID],
        },
      ]);
    });

    it('should create flows with connections', async () => {
      const sampleFlowWthFlowFormatedNew = {
        id: 'af_7AXxPP59pJx5ZtA471cSAw',
        name: 'Sample Flow Wth connection',
        actions: [
          {
            id: 'update_user_PmSa',
            alias: 'user meta data name',
            type: 'AUTH0',
            action: 'UPDATE_USER',
            allow_failure: false,
            mask_output: false,
            params: {
              connection_id: 'Sample Connection',
              user_id: '{{context.user.user_id}}',
              changes: {
                user_metadata: {
                  full_name: '{{fields.full_name}}',
                },
              },
            },
          },
        ],
      };
      const auth0 = {
        flows: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'flows', []),
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', [sampleConnectionWithID]),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          flows: [sampleFlowWthFlowFormatedNew],
        },
      ]);
    });

    it('should get flows', async () => {
      const auth0 = {
        flows: {
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFlowWthID);
          },
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleFlowWthID]);
    });

    it('should get flows with connection', async () => {
      const sampleFlowWthFlowFormatedNew = {
        id: 'af_7AXxPP59pJx5ZtA471cSAw',
        name: 'Sample Flow Wth connection',
        actions: [
          {
            id: 'update_user_PmSa',
            alias: 'user meta data name',
            type: 'AUTH0',
            action: 'UPDATE_USER',
            allow_failure: false,
            mask_output: false,
            params: {
              connection_id: 'Sample Connection',
              user_id: '{{context.user.user_id}}',
              changes: {
                user_metadata: {
                  full_name: '{{fields.full_name}}',
                },
              },
            },
          },
        ],
      };

      const sampleFlowWthConnectionWithIdNew = {
        id: 'af_7AXxPP59pJx5ZtA471cSAw',
        name: 'Sample Flow Wth connection',
        actions: [
          {
            id: 'update_user_PmSa',
            alias: 'user meta data name',
            type: 'AUTH0',
            action: 'UPDATE_USER',
            allow_failure: false,
            mask_output: false,
            params: {
              connection_id: 'ac_9AXxPP59pJx5ZtA471cSAy',
              user_id: '{{context.user.user_id}}',
              changes: {
                user_metadata: {
                  full_name: '{{fields.full_name}}',
                },
              },
            },
          },
        ],
      };
      const auth0 = {
        flows: {
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWthConnectionWithIdNew]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFlowWthConnectionWithIdNew);
          },
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', [sampleConnectionWithID]),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      expect(data).to.deep.equal([sampleFlowWthFlowFormatedNew]);
    });

    it('should update flows', async () => {
      const auth0 = {
        flows: {
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleFlowWthID.id);
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleFlowWthID.name);
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFlowWthID);
          },
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          flows: [sampleFlowWthID],
        },
      ]);
    });

    it('should delete flows and create another one instead', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;

      const newFlow = {
        name: sampleFlowWthID.name + ' new',
      };
      const auth0 = {
        flows: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(newFlow.name);
            return Promise.resolve(data);
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.a('string');
            expect(params).to.equal(sampleFlowWthID.id);
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFlowWthID);
          },
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ flows: [newFlow] }]);
    });

    it('should delete all flows', async () => {
      let removed = false;
      const auth0 = {
        flows: {
          delete: (params) => {
            removed = true;
            expect(params).to.be.a('string');
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFlowWthID);
          },
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ flows: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove flows if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        flows: {
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFlowWthID);
          },
          vault: {
            connections: {
              list: (params) => mockPagedData(params, 'connections', []),
            },
          },
        },
        pool,
      };

      const handler = new flows.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ flows: [] }]);
    });
  });
});
