import { PromisePoolExecutor } from 'promise-pool-executor';
import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const forms = require('../../../../src/tools/auth0/handlers/forms');
const { mockPagedData } = require('../../../utils');

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleFormWithOutId = {
  name: 'someForm',
  languages: {
    primary: 'en',
  },
};
const sampleFormWthID = {
  name: 'sample form 1',
  id: 'ap_9AXxPP59pJx5ZtA471cSAy',
};

const sampleFormTwoWthID = {
  name: 'sample form 2',
  id: 'ap_8AXxPP59pJx5ZtA471cSAw',
};

const sampleFlowWithID = {
  name: 'Sample Flow',
  id: 'af_9AXxPP59pJx5ZtA471cSAy',
};

const sampleFormWthFlowWithId = {
  id: 'ap_7AXxPP59pJx5ZtA471cSAw',
  name: 'Sample Form WthFlow',
  nodes: [
    {
      id: 'flow_tgyK',
      type: 'FLOW',
      coordinates: {
        x: 237,
        y: -326,
      },
      alias: 'New flow',
      config: {
        flow_id: sampleFlowWithID.id,
        next_node: 'flow_6a2h',
      },
    },
  ],
};

const sampleFormWthFlowFormated = {
  id: sampleFormWthFlowWithId.id,
  name: sampleFormWthFlowWithId.name,
  nodes: [
    {
      id: 'flow_tgyK',
      type: 'FLOW',
      coordinates: {
        x: 237,
        y: -326,
      },
      alias: 'New flow',
      config: {
        flow_id: 'Sample Flow',
        next_node: 'flow_6a2h',
      },
    },
  ],
};

describe('#forms handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#forms validate', () => {
    it('should not allow same names', async () => {
      const handler = new forms.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-form',
        },
        {
          name: 'some-form',
        },
      ];

      try {
        await stageFn.apply(handler, [{ forms: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new forms.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-form',
        },
      ];

      await stageFn.apply(handler, [{ clients: data }]);
    });
  });

  describe('#forms process', () => {
    it('should return empty if no forms asset', async () => {
      const auth0 = {
        forms: {},
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create forms', async () => {
      const auth0 = {
        forms: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleFormWithOutId.name);
            expect(data.languages).to.be.an('object');
            expect(data.languages.primary).to.equal(sampleFormWithOutId.languages.primary);
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          list: (params) => mockPagedData(params, 'forms', []),
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          forms: [sampleFormWithOutId],
        },
      ]);
    });

    it('should create forms with flow', async () => {
      const auth0 = {
        forms: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'forms', []),
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWithID]),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          forms: [sampleFormWthFlowFormated],
        },
      ]);
    });

    it('should get forms', async () => {
      const auth0 = {
        forms: {
          list: (params) => mockPagedData(params, 'forms', [sampleFormWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFormWthID);
          },
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleFormWthID]);
    });

    it('should get forms with flow', async () => {
      const sampleFormWthFlowFormatedNew = {
        id: sampleFormWthFlowWithId.id,
        name: sampleFormWthFlowWithId.name,
        nodes: [
          {
            id: 'flow_tgyK',
            type: 'FLOW',
            coordinates: {
              x: 237,
              y: -326,
            },
            alias: 'New flow',
            config: {
              flow_id: 'Sample Flow',
              next_node: 'flow_6a2h',
            },
          },
        ],
      };
      const auth0 = {
        forms: {
          list: (params) => mockPagedData(params, 'forms', [sampleFormWthFlowWithId]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFormWthFlowWithId);
          },
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', [sampleFlowWithID]),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      expect(data).to.deep.equal([sampleFormWthFlowFormatedNew]);
    });

    it('should update forms', async () => {
      const auth0 = {
        forms: {
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleFormWthID.id);
            expect(data).to.be.an('object');
            expect(data.languages).to.be.an('object');
            expect(data.languages.primary).to.equal('en');

            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'forms', [sampleFormWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFormWthID);
          },
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          forms: [
            {
              name: sampleFormWthID.name,
              id: sampleFormWthID.id,
              languages: {
                primary: 'en',
              },
            },
          ],
        },
      ]);
    });

    it('should delete forms and create another one instead', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;

      const auth0 = {
        forms: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleFormTwoWthID.name);
            return Promise.resolve(data);
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleFormWthID.id);
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'forms', [sampleFormWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFormWthID);
          },
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ forms: [{ name: sampleFormTwoWthID.name }] }]);
    });

    it('should delete all forms', async () => {
      let removed = false;
      const auth0 = {
        forms: {
          delete: (params) => {
            removed = true;
            expect(params).to.be.an('object');
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'forms', [sampleFormWthID, sampleFormTwoWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFormWthID);
          },
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ forms: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove forms if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        forms: {
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'forms', [sampleFormWthID, sampleFormTwoWthID]),
          get: (id) => {
            expect(id).to.be.a('string');
            return Promise.resolve(sampleFormWthID);
          },
        },
        flows: {
          list: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ forms: [] }]);
    });
  });
});
