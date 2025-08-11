import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const hooks = require('../../../../src/tools/auth0/handlers/hooks');
const { mockPagedData } = require('../../../utils');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#hooks handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_CLIENT_ID: 'client_id',
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#hooks dryRunChanges', () => {
    const dryRunConfig = function (key) {
      return dryRunConfig.data && dryRunConfig.data[key];
    };

    dryRunConfig.data = {
      AUTH0_CLIENT_ID: 'client_id',
      AUTH0_ALLOW_DELETE: true,
    };

    it('should return create changes for new hooks', async () => {
      const auth0 = {
        hooks: {
          getAll: (params) => mockPagedData(params, 'hooks', []),
          get: () => Promise.resolve({ data: {} }),
          getSecrets: () => Promise.resolve({ data: {} }),
        },
        pool,
      };

      const handler = new hooks.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        hooks: [
          {
            name: 'Hook 1',
            triggerId: 'pre-user-registration',
            script: 'function(user, context, callback) { callback(null, user); }',
          },
          {
            name: 'Hook 2',
            triggerId: 'post-user-registration',
            script: 'function(user, context, callback) { callback(null, user); }',
          },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(2);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return update changes for existing hooks with differences', async () => {
      const existingHooks = [
        {
          id: 'hook1',
          name: 'Hook 1',
          triggerId: 'pre-user-registration',
          script: 'old script',
          secrets: {},
        },
        {
          id: 'hook2',
          name: 'Hook 2',
          triggerId: 'post-user-registration',
          script: 'old script',
          secrets: {},
        },
      ];

      const auth0 = {
        hooks: {
          getAll: (params) =>
            mockPagedData(
              params,
              'hooks',
              existingHooks.map((h) => ({ id: h.id, name: h.name, triggerId: h.triggerId }))
            ),
          get: (params) => {
            const hook = existingHooks.find((h) => h.id === params.id);
            return Promise.resolve({ data: hook });
          },
          getSecrets: () => Promise.resolve({ data: {} }),
        },
        pool,
      };

      const handler = new hooks.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        hooks: [
          { name: 'Hook 1', triggerId: 'pre-user-registration', script: 'new script 1' },
          { name: 'Hook 2', triggerId: 'post-user-registration', script: 'new script 2' },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(2);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return delete changes for hooks not in assets', async () => {
      const existingHooks = [
        {
          id: 'hook1',
          name: 'Hook 1',
          triggerId: 'pre-user-registration',
          script: 'script',
          secrets: {},
        },
        {
          id: 'hook2',
          name: 'Hook 2',
          triggerId: 'post-user-registration',
          script: 'script',
          secrets: {},
        },
        {
          id: 'hook3',
          name: 'Hook 3',
          triggerId: 'post-change-password',
          script: 'script',
          secrets: {},
        },
      ];

      const auth0 = {
        hooks: {
          getAll: (params) =>
            mockPagedData(
              params,
              'hooks',
              existingHooks.map((h) => ({ id: h.id, name: h.name, triggerId: h.triggerId }))
            ),
          get: (params) => {
            const hook = existingHooks.find((h) => h.id === params.id);
            return Promise.resolve({ data: hook });
          },
          getSecrets: () => Promise.resolve({ data: {} }),
        },
        pool,
      };

      const handler = new hooks.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        hooks: [{ name: 'Hook 1', triggerId: 'pre-user-registration', script: 'script' }],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(2);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should return no changes when hooks are identical', async () => {
      const existingHooks = [
        {
          id: 'hook1',
          name: 'Hook 1',
          triggerId: 'pre-user-registration',
          script: 'script 1',
          secrets: {},
        },
        {
          id: 'hook2',
          name: 'Hook 2',
          triggerId: 'post-user-registration',
          script: 'script 2',
          secrets: {},
        },
      ];

      const auth0 = {
        hooks: {
          getAll: (params) =>
            mockPagedData(
              params,
              'hooks',
              existingHooks.map((h) => ({ id: h.id, name: h.name, triggerId: h.triggerId }))
            ),
          get: (params) => {
            const hook = existingHooks.find((h) => h.id === params.id);
            return Promise.resolve({ data: hook });
          },
          getSecrets: () => Promise.resolve({ data: {} }),
        },
        pool,
      };

      const handler = new hooks.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        hooks: [
          { name: 'Hook 1', triggerId: 'pre-user-registration', script: 'script 1' },
          { name: 'Hook 2', triggerId: 'post-user-registration', script: 'script 2' },
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle mixed create, update, and delete operations', async () => {
      const existingHooks = [
        {
          id: 'hook1',
          name: 'Hook 1',
          triggerId: 'pre-user-registration',
          script: 'old script',
          secrets: {},
        },
        {
          id: 'hook2',
          name: 'Hook 2',
          triggerId: 'post-user-registration',
          script: 'old script',
          secrets: {},
        },
      ];

      const auth0 = {
        hooks: {
          getAll: (params) =>
            mockPagedData(
              params,
              'hooks',
              existingHooks.map((h) => ({ id: h.id, name: h.name, triggerId: h.triggerId }))
            ),
          get: (params) => {
            const hook = existingHooks.find((h) => h.id === params.id);
            return Promise.resolve({ data: hook });
          },
          getSecrets: () => Promise.resolve({ data: {} }),
        },
        pool,
      };

      const handler = new hooks.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {
        hooks: [
          // Update: same name + triggerId, different script
          { name: 'Hook 1', triggerId: 'pre-user-registration', script: 'new script' },
          // Create: new name + triggerId combination
          { name: 'Hook 3', triggerId: 'post-change-password', script: 'new hook script' },
          // Hook 2 will be deleted (not in assets)
        ],
      };

      const changes = await handler.dryRunChanges(assets);

      // For mixed operations, just verify we get some changes of each type
      expect(changes.create.length).to.be.greaterThan(0);
      expect(changes.update.length).to.be.greaterThan(0);
      expect(changes.del.length).to.be.greaterThan(0);
      expect(changes.conflicts).to.have.length(0);
    });

    it('should handle empty assets', async () => {
      const auth0 = {
        hooks: {
          getAll: (params) => mockPagedData(params, 'hooks', []),
          get: () => Promise.resolve({ data: {} }),
          getSecrets: () => Promise.resolve({ data: {} }),
        },
        pool,
      };

      const handler = new hooks.default({ client: pageClient(auth0), config: dryRunConfig });
      const assets = {}; // No hooks property

      const changes = await handler.dryRunChanges(assets);

      expect(changes.create).to.have.length(0);
      expect(changes.update).to.have.length(0);
      expect(changes.del).to.have.length(0);
      expect(changes.conflicts).to.have.length(0);
    });
  });
});
