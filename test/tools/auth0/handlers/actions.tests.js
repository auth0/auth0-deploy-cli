const { expect } = require('chai');
const actions = require('../../../../src/tools/auth0/handlers/actions');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  }
};

describe('#actions handler', () => {
  const config = function(key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true
  };

  describe('#Actions validate', () => {
    it('should not allow same names', (done) => {
      const auth0 = {
        actions: {
          getAll: () => []
        }
      };

      const handler = new actions.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'actions-one',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1'
            }
          ]
        },
        {
          name: 'actions-one',
          supported_triggers: [
            {
              id: 'credentials-exchange',
              version: 'v1'
            }
          ]
        }
      ];

      stageFn
        .apply(handler, [ { actions: data } ])
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
          getAll: () => []
        }
      };

      const handler = new actions.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'action-one',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1'
            }
          ],
          deployed_version: {
            code: 'some code',
            dependencies: [],
            secrets: [],
            runtime: 'node12'
          }
        },
        {
          name: 'action-two',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1'
            }
          ],
          deployed_version: {
            code: "/** @type {PostLoginAction} */\nmodule.exports = async (event, context) => {\n    console.log('new version');\n    return {};\n  };\n  ",
            dependencies: [],
            secrets: [],
            runtime: 'node12'
          }
        }
      ];

      await stageFn.apply(handler, [ { actions: data } ]);
    });
  });

  describe('#action process', () => {
    it('should create action', async () => {
      const version = {
        code: 'action-code',
        dependencies: [],
        id: 'version-id',
        runtime: 'node12',
        secrets: []
      };

      const actionId = 'new-action-id';
      const action = {
        name: 'action-test',
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1'
          }
        ],
        deployed_version: {
          code: 'some code',
          dependencies: [],
          secrets: [],
          runtime: 'node12'
        }
      };

      const auth0 = {
        actions: {
          get: (params) => {
            expect(params.id).to.equal(actionId);
            return Promise.resolve({ ...action, id: actionId });
          },
          create: (data) => {
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
              return Promise.resolve({ actions: [] });
            }

            return Promise.resolve({
              actions: [
                {
                  name: action.name,
                  supported_triggers: action.supported_triggers,
                  id: actionId
                }
              ]
            });
          },
          createVersion: () => Promise.resolve(version)
        },
        pool,
        getAllCalled: false
      };

      const handler = new actions.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { actions: [ action ] } ]);
    });

    it('should get actions', async () => {
      const code = 'action-code';

      const version = {
        code: code,
        dependencies: [],
        id: 'version-id',
        runtime: 'node12',
        secrets: [],
        status: 'build'
      };

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
              version: 'v1'
            }
          ],
          deployed_version: { id: version.id }
        }
      ];

      const auth0 = {
        actions: {
          getAll: () => Promise.resolve({ actions: actionsData }),
          getVersions: (params) => {
            expect(params.action_id).to.equal('action-id-1');
            expect(params.version_id).to.equal('version-id');
            return Promise.resolve(version);
          }
        }
      };

      const handler = new actions.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([
        { ...actionsData[0], deployed: true, deployed_version: version }
      ]);
    });

    it('should return an null for 501 status code', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error('Feature is not yet implemented');
            error.statusCode = 501;
            throw error;
          }
        },
        pool
      };

      const handler = new actions.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should return an null for 404 status code', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            throw error;
          }
        },
        pool
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
                  errorCode: 'feature_not_enabled'
                }
              }
            };
            throw error;
          }
        },
        pool
      };

      const handler = new actions.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should throw an error for all other failed requests', async () => {
      const auth0 = {
        actions: {
          getAll: () => {
            const error = new Error('Bad request');
            error.statusCode = 500;
            throw error;
          }
        },
        pool
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
          getAll: () => Promise.resolve({
            actions: [
              {
                id: 'action-1',
                name: 'action-test',
                supported_triggers: [
                  {
                    id: 'post-login',
                    version: 'v1'
                  }
                ]
              }
            ]
          }),
          getVersion: () => Promise.resolve({
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
            updated_at: '2020-12-03T15:20:54.415669983Z'
          })
        },
        pool
      };

      const handler = new actions.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { action: [] } ]);
    });
  });
});
