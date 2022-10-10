const { expect } = require('chai');
const actions = require('../../../../src/tools/auth0/handlers/actions');

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
          getAll: () => [],
        },
      };

      const handler = new actions.default({ client: auth0, config });
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
          getAll: () => [],
        },
      };

      const handler = new actions.default({ client: auth0, config });
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
            return Promise.resolve({ ...action, id: actionId });
          },
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('action-test');
            expect(data.supported_triggers[0].id).to.equal('post-login');
            expect(data.supported_triggers[0].version).to.equal('v1');
            return Promise.resolve({ ...data, id: actionId });
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          getAll: () => {
            if (!auth0.getAllCalled) {
              auth0.getAllCalled = true;
              return Promise.resolve([]);
            }

            return Promise.resolve({
              actions: [
                {
                  name: action.name,
                  supported_triggers: action.supported_triggers,
                  id: actionId,
                },
              ],
            });
          },
          createVersion: () => Promise.resolve(version),
        },
        pool,
        getAllCalled: false,
      };

      const handler = new actions.default({ client: auth0, config });
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
            return Promise.resolve({ ...action, id: actionId });
          },
          create: (data) => Promise.resolve({ ...data, id: actionId }),
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          getAll: () => {
            if (!auth0.getAllCalled) {
              auth0.getAllCalled = true;
              return Promise.resolve([]);
            }

            return Promise.resolve([
              {
                name: action.name,
                supported_triggers: action.supported_triggers,
                id: actionId,
              },
            ]);
          },
          createVersion: () => Promise.resolve(version),
          deploy: (data) => {
            expect(data).to.deep.equal({ id: actionId });
            didDeployGetCalled = true;
          },
        },
        pool,
        getAllCalled: false,
      };

      const handler = new actions.default({ client: auth0, config });
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
          getAll: () => actionsData,
        },
      };

      const handler = new actions.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.include({ ...actionsData[0], deployed: true });
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

      const handler = new actions.default({ client: auth0, config });
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

      const handler = new actions.default({ client: auth0, config });
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

      const handler = new actions.default({ client: auth0, config });
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

      const handler = new actions.default({ client: auth0, config });
      try {
        await handler.getType();
      } catch (error) {
        expect(error).to.be.an.instanceOf(Error);
      }
    });

    it('should remove action', async () => {
      const auth0 = {
        actions: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('action-1');
            return Promise.resolve(data);
          },
          getAll: () =>
            Promise.resolve([
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
            }),
        },
        pool,
      };

      const handler = new actions.default({ client: auth0, config });
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
          getAll: () => Promise.resolve([marketplaceAction]),
          delete: () => {
            wasDeleteCalled = true;
          },
        },
        pool,
      };

      const handler = new actions.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{ actions: [] }]);

      expect(wasDeleteCalled).to.equal(false);
    });
  });
});
