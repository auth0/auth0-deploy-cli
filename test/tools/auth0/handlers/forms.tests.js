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
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'forms', []),
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
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
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'forms', []),
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', [sampleFlowWithID]),
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
          getAll: (params) => mockPagedData(params, 'forms', [sampleFormWthID]),
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.be.a('string');
            return Promise.resolve({
              data: sampleFormWthID,
            });
          },
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
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
          getAll: (params) => mockPagedData(params, 'forms', [sampleFormWthFlowWithId]),
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.be.a('string');
            return Promise.resolve({
              data: sampleFormWthFlowWithId,
            });
          },
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', [sampleFlowWithID]),
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
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleFormWthID.id);
            expect(data).to.be.an('object');
            expect(data.languages).to.be.an('object');
            expect(data.languages.primary).to.equal('en');

            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'forms', [sampleFormWthID]),
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.be.a('string');
            return Promise.resolve({
              data: sampleFormWthID,
            });
          },
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
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
            return Promise.resolve({ data });
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleFormWthID.id);
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'forms', [sampleFormWthID]),
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.be.a('string');
            return Promise.resolve({
              data: sampleFormWthID,
            });
          },
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
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
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'forms', [sampleFormWthID, sampleFormTwoWthID]),
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.be.a('string');
            return Promise.resolve({
              data: sampleFormWthID,
            });
          },
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
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
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'forms', [sampleFormWthID, sampleFormTwoWthID]),
          get: (params) => {
            expect(params).to.be.an('object');
            expect(params.id).to.be.a('string');
            return Promise.resolve({
              data: sampleFormWthID,
            });
          },
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ forms: [] }]);
    });
  });

  describe('#forms dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return create changes for new forms', async () => {
      const auth0 = {
        forms: {
          getAll: (params) => mockPagedData(params, 'forms', []),
          get: () => Promise.resolve({ data: null }),
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        forms: [
          {
            name: 'New Form 1',
            languages: { primary: 'en' },
            nodes: [],
          },
          {
            name: 'New Form 2',
            languages: { primary: 'es' },
            nodes: [],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(2);
      expect(changes.create[0]).to.include({ name: 'New Form 1' });
      expect(changes.create[1]).to.include({ name: 'New Form 2' });
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return update changes for existing forms with differences', async () => {
      const auth0 = {
        forms: {
          getAll: (params) =>
            mockPagedData(params, 'forms', [
              {
                id: 'form1',
                name: 'Existing Form',
                languages: { primary: 'en' },
                nodes: [],
              },
            ]),
          get: (params) =>
            Promise.resolve({
              data: {
                id: params.id,
                name: 'Existing Form',
                languages: { primary: 'en' },
                nodes: [],
              },
            }),
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        forms: [
          {
            name: 'Existing Form',
            languages: { primary: 'es' },
            nodes: [],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.update[0]).to.include({
        name: 'Existing Form',
        id: 'form1',
      });
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for forms not in assets', async () => {
      const auth0 = {
        forms: {
          getAll: (params) =>
            mockPagedData(params, 'forms', [
              { id: 'form1', name: 'Form To Remove', languages: { primary: 'en' } },
            ]),
          get: (params) =>
            Promise.resolve({
              data: {
                id: params.id,
                name: 'Form To Remove',
                languages: { primary: 'en' },
                nodes: [],
              },
            }),
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = { forms: [] };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(1);
      expect(changes.del[0]).to.include({ id: 'form1', name: 'Form To Remove' });
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when forms are identical', async () => {
      const auth0 = {
        forms: {
          getAll: (params) =>
            mockPagedData(params, 'forms', [
              {
                id: 'form1',
                name: 'Unchanged Form',
                languages: { primary: 'en' },
                nodes: [],
              },
            ]),
          get: (params) =>
            Promise.resolve({
              data: {
                id: params.id,
                name: 'Unchanged Form',
                languages: { primary: 'en' },
                nodes: [],
              },
            }),
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        forms: [
          {
            name: 'Unchanged Form',
            languages: { primary: 'en' },
            nodes: [],
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
        forms: {
          getAll: (params) =>
            mockPagedData(params, 'forms', [
              { id: 'form1', name: 'Update Form', languages: { primary: 'en' } },
              { id: 'form2', name: 'Delete Form', languages: { primary: 'fr' } },
            ]),
          get: (params) => {
            if (params.id === 'form1') {
              return Promise.resolve({
                data: { id: 'form1', name: 'Update Form', languages: { primary: 'en' }, nodes: [] },
              });
            }
            if (params.id === 'form2') {
              return Promise.resolve({
                data: { id: 'form2', name: 'Delete Form', languages: { primary: 'fr' }, nodes: [] },
              });
            }
            return Promise.resolve({ data: null });
          },
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        forms: [
          { name: 'Update Form', languages: { primary: 'es' } },
          { name: 'Create Form', languages: { primary: 'de' } },
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
        forms: {
          getAll: (params) => mockPagedData(params, 'forms', []),
          get: () => Promise.resolve({ data: null }),
        },
        flows: {
          getAll: (params) => mockPagedData(params, 'flows', []),
        },
        pool,
      };

      const handler = new forms.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {}; // No forms property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
