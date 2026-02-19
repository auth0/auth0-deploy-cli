import { expect } from 'chai';
import ActionModulesHandler from '../../../../src/tools/auth0/handlers/actionModules';
import pageClient from '../../../../src/tools/auth0/client';
import { mockPagedData } from '../../../utils';

const pool = {
  addEachTask: (data: any) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#actionModules handler', () => {
  const config = function (key: string) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#ActionModules validate', () => {
    it('should not allow same names', (done) => {
      const auth0 = {
        actions: {
          modules: {
            list: () => Promise.resolve({ data: [] }),
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'module-one',
          code: 'module.exports = {};',
        },
        {
          name: 'module-one',
          code: 'module.exports = {};',
        },
      ];

      stageFn
        .apply(handler, [{ actionModules: data }])
        .then(() => done(new Error('Expecting error')))
        .catch((err: Error) => {
          expect(err).to.be.an('object');
          expect(err.message).to.include('Names must be unique');
          done();
        });
    });

    it('should pass validation', async () => {
      const auth0 = {
        actions: {
          modules: {
            list: () => Promise.resolve({ data: [] }),
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'module-one',
          code: 'module.exports = {};',
          dependencies: [],
          secrets: [],
        },
        {
          name: 'module-two',
          code: 'module.exports = {};',
          dependencies: [],
          secrets: [],
        },
      ];

      await stageFn.apply(handler, [{ actionModules: data }]);
    });
  });

  describe('#actionModule process', () => {
    it('should create action module', async () => {
      const moduleId = 'new-module-id';
      const module = {
        name: 'module-test',
        code: 'module.exports = {};',
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.21',
          },
        ],
        secrets: [],
      };

      let listCalled = false;

      const auth0 = {
        actions: {
          modules: {
            create: function (data: any) {
              expect(data).to.be.an('object');
              expect(data.name).to.equal('module-test');
              expect(data.code).to.equal('module.exports = {};');
              return Promise.resolve({ data: { ...data, id: moduleId } });
            },
            update: () => Promise.resolve({ data: [] }),
            delete: () => Promise.resolve({ data: [] }),
            list: () => {
              if (!listCalled) {
                listCalled = true;
                return mockPagedData({ paginate: true }, 'modules', []);
              }
              return mockPagedData({ paginate: true }, 'modules', [
                {
                  name: module.name,
                  code: module.code,
                  id: moduleId,
                },
              ]);
            },
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ actionModules: [module] }]);
    });

    it('should get action modules', async () => {
      const code = 'module.exports = {};';

      const modulesData = [
        {
          id: 'module-id-1',
          name: 'module-test-1',
          code: code,
          dependencies: [],
          secrets: [],
          actions_using_module_total: 0,
          all_changes_published: true,
          latest_version_number: 1,
        },
      ];

      const auth0 = {
        actions: {
          modules: {
            list: () => mockPagedData({ paginate: true }, 'modules', modulesData),
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.be.an('array');
      expect(data).to.have.lengthOf(1);
      expect(data?.[0]).to.deep.include(modulesData[0]);
    });

    it('should update action module', async () => {
      const moduleId = 'existing-module-id';
      const existingModule = {
        id: moduleId,
        name: 'module-test',
        code: 'module.exports = { old: true };',
        dependencies: [],
        secrets: [],
      };

      const updatedModule = {
        name: 'module-test',
        code: 'module.exports = { new: true };',
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.21',
          },
        ],
        secrets: [],
      };

      const auth0 = {
        actions: {
          modules: {
            create: () => Promise.resolve({ data: [] }),
            update: function (id: string, data: any) {
              expect(id).to.equal(moduleId);
              expect(data).to.be.an('object');
              expect(data.code).to.equal('module.exports = { new: true };');
              return Promise.resolve({ data: { ...updatedModule, id: moduleId } });
            },
            delete: () => Promise.resolve({ data: [] }),
            list: () => mockPagedData({ paginate: true }, 'modules', [existingModule]),
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ actionModules: [updatedModule] }]);
    });

    it('should remove action module', async () => {
      const auth0 = {
        actions: {
          modules: {
            create: () => Promise.resolve({ data: [] }),
            update: () => Promise.resolve({ data: [] }),
            delete: (id: string) => {
              expect(id).to.be.a('string');
              expect(id).to.equal('module-1');
              return Promise.resolve({ data: id });
            },
            list: () =>
              mockPagedData({ paginate: true }, 'modules', [
                {
                  id: 'module-1',
                  name: 'module-test',
                  code: 'module.exports = {};',
                  dependencies: [],
                  secrets: [],
                },
              ]),
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ actionModules: [] }]);
    });

    it('should return null for 404 status code', async () => {
      const auth0 = {
        actions: {
          modules: {
            list: () => {
              const error: any = new Error('Not found');
              error.statusCode = 404;
              throw error;
            },
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should return null for 501 status code', async () => {
      const auth0 = {
        actions: {
          modules: {
            list: () => {
              const error: any = new Error('Feature is not yet implemented');
              error.statusCode = 501;
              throw error;
            },
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });

    it('should return null when the feature flag is disabled', async () => {
      const auth0 = {
        actions: {
          modules: {
            list: () => {
              const error: any = new Error('Not enabled');
              error.statusCode = 403;
              error.errorCode = 'feature_not_enabled';
              throw error;
            },
          },
        },
        pool,
      };

      const handler = new ActionModulesHandler({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal(null);
    });
  });
});
