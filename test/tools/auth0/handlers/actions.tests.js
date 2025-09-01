import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import pageClient from '../../../../src/tools/auth0/client';

const actions = require('../../../../src/tools/auth0/handlers/actions');
const { mockPagedData } = require('../../../utils');

chai.use(chaiAsPromised);

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#actions handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#Actions validate', () => {
    it('should not allow same names', (done) => {
      const auth0 = {
        actions: {
          getAll: () => ({ data: [] }),
        },
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'actions-one',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1',
            },
          ],
        },
        {
          name: 'actions-one',
          supported_triggers: [
            {
              id: 'credentials-exchange',
              version: 'v1',
            },
          ],
        },
      ];

      stageFn
        .apply(handler, [{ actions: data }])
        .then(() => done(new Error('Expecting error')))
        .catch((err) => {
          expect(err).to.be.an('object');
          expect(err.message).to.include('Names must be unique');
          done();
        });
    });

    it('should pass validation', async () => {
      const auth0 = {
        actions: {
          getAll: () => ({ data: [] }),
        },
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'action-one',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1',
            },
          ],
          deployed_version: {
            code: 'some code',
            dependencies: [],
            secrets: [],
            runtime: 'node12',
          },
        },
        {
          name: 'action-two',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1',
            },
          ],
        },
      ];

      await stageFn.apply(handler, [{ actions: data }]);
    });
  });

  describe('#action process', () => {
    it('should create action', async () => {
      const version = {
        code: 'action-code',
        dependencies: [],
        id: 'version-id',
        runtime: 'node12',
        secrets: [],
      };

      const actionId = 'new-action-id';
      const action = {
        name: 'action-test',
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
      };

      const auth0 = {
        actions: {
          get: (params) => {
            expect(params.id).to.equal(actionId);
            return Promise.resolve({ data: { ...action, id: actionId } });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('action-test');
            expect(data.supported_triggers[0].id).to.equal('post-login');
            expect(data.supported_triggers[0].version).to.equal('v1');
            return Promise.resolve({ data: { ...data, id: actionId } });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: () => {
            if (!auth0.getAllCalled) {
              auth0.getAllCalled = true;
              return Promise.resolve({ data: [] });
            }
            return Promise.resolve({
              data: {
                actions: [
                  {
                    name: action.name,
                    supported_triggers: action.supported_triggers,
                    id: actionId,
                  },
                ],
              },
            });
          },
          createVersion: () => Promise.resolve({ data: version }),
        },
        pool,
        getAllCalled: true,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ actions: [action] }]);
    });

    it('newly-created action should get deployed', async () => {
      let didDeployGetCalled = false;

      const version = {
        code: 'action-code',
        dependencies: [],
        id: 'version-id',
        runtime: 'node12',
        secrets: [],
      };

      const actionId = 'new-action-id';
      const action = {
        name: 'action-test',
        deployed: true,
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
      };

      const auth0 = {
        actions: {
          get: (params) => {
            expect(params.id).to.equal(actionId);
            return Promise.resolve({ data: { ...action, id: actionId } });
          },
          create: (data) => Promise.resolve({ data: { ...data, id: actionId } }),
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: () => {
            if (!auth0.getAllCalled) {
              auth0.getAllCalled = true;
              return Promise.resolve(mockPagedData({ include_totals: true }, 'actions', []));
            }

            return Promise.resolve(
              mockPagedData({ include_totals: true }, 'actions', [
                {
                  name: action.name,
                  supported_triggers: action.supported_triggers,
                  id: actionId,
                },
              ])
            );
          },
          createVersion: () => Promise.resolve({ data: version }),
          deploy: (data) => {
            expect(data).to.deep.equal({ id: actionId });
            didDeployGetCalled = true;
          },
        },
        pool,
        getAllCalled: false,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ actions: [action] }]);

      expect(didDeployGetCalled).to.equal(true);
    });

    it('should get actions', async () => {
      const code = 'action-code';

      const actionsData = [
        {
          id: 'action-id-1',
          name: 'action-test-1',
          secrets: [],
          dependencies: [],
          code: code,
          status: 'build',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1',
            },
          ],
          deployed: true,
        },
      ];

      const auth0 = {
        actions: {
          getAll: () => mockPagedData({ include_totals: true }, 'actions', actionsData),
        },
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.include({ ...actionsData[0], deployed: true });
    });

    it('should throw informative error when actions service returns "An internal server error occurred" 500 error', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error();
            error.statusCode = 500;
            error.message = 'An internal server error occurred';
            throw error;
          },
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      await expect(handler.getType()).to.be.rejectedWith(
        "Cannot process actions because the actions service is currently unavailable. Retrying may result in a successful operation. Alternatively, adding 'actions' to `AUTH0_EXCLUDED` configuration property will provide ability to skip until service is restored to actions service. This is not an issue with the Deploy CLI."
      );
    });

    it('should return an empty array for 501 status code', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error('Feature is not yet implemented');
            error.statusCode = 501;
            throw error;
          },
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should return an empty array for 404 status code', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          },
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should return an empty array when the feature flag is disabled', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error('Not enabled');
            error.statusCode = 403;
            error.originalError = {
              response: {
                body: {
                  errorCode: 'feature_not_enabled',
                },
              },
            };
            throw error;
          },
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error('Bad request');
            error.statusCode = 500;
            throw error;
          },
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
      }
    });

    it('should remove action', async () => {
      const auth0 = {
        actions: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('action-1');
            return Promise.resolve({ data });
          },
          getAll: () =>
            mockPagedData({ include_totals: true }, 'actions', [
              {
                id: 'action-1',
                name: 'action-test',
                supported_triggers: [
                  {
                    id: 'post-login',
                    version: 'v1',
                  },
                ],
              },
            ]),
          getVersion: () =>
            Promise.resolve({
              data: {
                action: {},
                code: "/** @type {PostLoginAction} */\nmodule.exports = async (event, context) => {\n    console.log('new version');\n    return {};\n  };\n  ",
                dependencies: [],
                runtime: 'node12',
                id: '0906fe5b-f4d6-44ec-a8f1-3c05fc186483',
                deployed: true,
                number: 1,
                built_at: '2020-12-03T15:20:54.413725492Z',
                status: 'built',
                created_at: '2020-12-03T15:20:52.094497448Z',
                updated_at: '2020-12-03T15:20:54.415669983Z',
              },
            }),
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ actions: [] }]);
    });

    it('should not remove marketplace action', async () => {
      let wasDeleteCalled = false;

      const marketplaceAction = {
        id: 'D1AF7CCF-7ZAB-417F-81C0-533595A926D8',
        name: 'Travel0 Integration',
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
        created_at: '2022-08-22T23:57:45.856907897Z',
        updated_at: '2022-08-22T23:57:45.856907897Z',
        installed_integration_id: '73f156dc-e7aa-47b4-9dda-0ef741205c31',
        integration: {
          id: '046042e2-5732-48ef-9313-0a93778ea8b1',
          catalog_id: 'travel0-action',
          url_slug: 'travel0-sms',
          partner_id: 'bea44019-d08d-47cd-b4f9-30074ca2ab69',
          name: 'Travel0',
          logo: 'https://cdn.auth0.com/travel0-logo.png',
          updated_at: '2022-05-03T15:05:45.684007768Z',
          created_at: '2021-08-24T20:49:30.446854653Z',
          feature_type: 'action',
          current_release: {
            id: '',
            semver: {},
          },
          all_changes_deployed: false,
        },
      };

      const auth0 = {
        actions: {
          getAll: () => Promise.resolve({ data: { actions: [marketplaceAction] } }),
          delete: () => {
            wasDeleteCalled = true;
          },
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ actions: [] }]);

      expect(wasDeleteCalled).to.equal(false);
    });
  });

  describe('#actions dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return create changes for new actions', async () => {
      const auth0 = {
        actions: {
          getAll: () => mockPagedData({ include_totals: true }, 'actions', []),
          getVersions: () => Promise.resolve({ data: { versions: [] } }),
          getTriggersAndBindings: () => Promise.resolve({ data: { triggers: [], bindings: [] } }),
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        actions: [
          {
            name: 'New Action 1',
            code: 'console.log("hello");',
            supported_triggers: [{ id: 'post-login', version: 'v1' }],
          },
          {
            name: 'New Action 2',
            code: 'console.log("world");',
            supported_triggers: [{ id: 'pre-user-registration', version: 'v1' }],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(2);
      expect(changes.create[0]).to.include({ name: 'New Action 1' });
      expect(changes.create[1]).to.include({ name: 'New Action 2' });
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return update changes for existing actions with differences', async () => {
      const auth0 = {
        actions: {
          getAll: () =>
            mockPagedData({ include_totals: true }, 'actions', [
              {
                id: 'action1',
                name: 'Existing Action',
                code: 'console.log("old");',
                supported_triggers: [{ id: 'post-login', version: 'v1' }],
              },
            ]),
          getVersions: () => Promise.resolve({ data: { versions: [] } }),
          getTriggersAndBindings: () => Promise.resolve({ data: { triggers: [], bindings: [] } }),
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        actions: [
          {
            name: 'Existing Action',
            code: 'console.log("new");',
            supported_triggers: [{ id: 'post-login', version: 'v1' }],
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(1);
      expect(changes.update[0]).to.include({
        name: 'Existing Action',
        id: 'action1',
      });
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for actions not in assets', async () => {
      const auth0 = {
        actions: {
          getAll: () =>
            mockPagedData({ include_totals: true }, 'actions', [
              { id: 'action1', name: 'Action To Remove', code: 'console.log("remove");' },
            ]),
          getVersions: () => Promise.resolve({ data: { versions: [] } }),
          getTriggersAndBindings: () => Promise.resolve({ data: { triggers: [], bindings: [] } }),
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = { actions: [] };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(1);
      expect(changes.del[0]).to.include({ id: 'action1', name: 'Action To Remove' });
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when actions are identical', async () => {
      const auth0 = {
        actions: {
          getAll: () =>
            mockPagedData({ include_totals: true }, 'actions', [
              {
                id: 'action1',
                name: 'Unchanged Action',
                code: 'console.log("unchanged");',
                supported_triggers: [{ id: 'post-login', version: 'v1' }],
              },
            ]),
          getVersions: () => Promise.resolve({ data: { versions: [] } }),
          getTriggersAndBindings: () => Promise.resolve({ data: { triggers: [], bindings: [] } }),
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        actions: [
          {
            name: 'Unchanged Action',
            code: 'console.log("unchanged");',
            supported_triggers: [{ id: 'post-login', version: 'v1' }],
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
        actions: {
          getAll: () =>
            mockPagedData({ include_totals: true }, 'actions', [
              { id: 'action1', name: 'Update Action', code: 'console.log("old");' },
              { id: 'action2', name: 'Delete Action', code: 'console.log("delete");' },
            ]),
          getVersions: () => Promise.resolve({ data: { versions: [] } }),
          getTriggersAndBindings: () => Promise.resolve({ data: { triggers: [], bindings: [] } }),
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        actions: [
          { name: 'Update Action', code: 'console.log("new");' },
          { name: 'Create Action', code: 'console.log("create");' },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create.length).to.be.equal(1);
      expect(changes.update.length).to.be.equal(2);
      expect(changes.del.length).to.be.equal(1);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const auth0 = {
        actions: {
          getAll: (params) => mockPagedData(params, 'actions', []),
          getVersions: () => Promise.resolve({ data: { versions: [] } }),
          getTriggersAndBindings: () => Promise.resolve({ data: { triggers: [], bindings: [] } }),
        },
        pool,
      };

      const handler = new actions.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {}; // No actions property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
