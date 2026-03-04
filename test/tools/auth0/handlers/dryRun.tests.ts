import { expect } from 'chai';
import pageClient from '../../../../src/tools/auth0/client';
import ActionsHandler from '../../../../src/tools/auth0/handlers/actions';
import ConnectionsHandler from '../../../../src/tools/auth0/handlers/connections';
import DatabasesHandler from '../../../../src/tools/auth0/handlers/databases';
import HooksHandler from '../../../../src/tools/auth0/handlers/hooks';
import RulesConfigsHandler from '../../../../src/tools/auth0/handlers/rulesConfigs';
import RulesHandler from '../../../../src/tools/auth0/handlers/rules';
import constants from '../../../../src/tools/constants';
import { mockPagedData } from '../../../utils';

const pool = {
  addEachTask: ({ data, generator }: any) => ({
    promise: () => Promise.all((data || []).map((item: any) => generator(item))),
  }),
  addSingleTask: ({ data, generator }: any) => ({
    promise: () => Promise.resolve(generator(data)),
  }),
};

describe('#handler dryRunChanges', () => {
  const config = function (key: string) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
    AUTH0_DRY_RUN: 'preview',
  } as Record<string, any>;

  it('connections should normalize idpinitiated client IDs during dry run', async () => {
    const auth0 = {
      connections: {
        list: (params: any) =>
          mockPagedData(params, 'connections', [
            {
              id: 'con1',
              name: 'google-oauth2-new',
              strategy: 'oidc',
              options: {
                idpinitiated: {
                  client_id: 'client-id-2',
                },
              },
            },
          ]),
        clients: {
          get: (_connectionId: any, params: any) => mockPagedData(params, 'connections', []),
        },
        directoryProvisioning: {
          list: (_params: any) => Promise.reject({ statusCode: 404 }),
        },
      },
      clients: {
        list: (params: any) =>
          mockPagedData(params, 'clients', [
            { name: 'idp-app', client_id: 'client-id-2' },
            { name: 'app-one', client_id: 'client-id-1' },
          ]),
      },
      pool,
    };

    const handler = new ConnectionsHandler({ client: pageClient(auth0 as any), config } as any);
    (handler as any).scimHandler = {
      createIdMap: async () => undefined,
      applyScimConfiguration: async () => undefined,
      updateOverride: async () => undefined,
      createOverride: async () => undefined,
    };

    const changes = await handler.dryRunChanges({
      connections: [
        {
          name: 'google-oauth2-new',
          strategy: 'oidc',
          options: {
            idpinitiated: {
              client_id: 'idp-app',
            },
          },
        },
      ],
    } as any);

    expect(changes.update).to.have.length(0);
  });

  it('databases should normalize action and enabled clients during dry run', async () => {
    const auth0 = {
      connections: {
        list: (params: any) =>
          mockPagedData(params, 'connections', [
            {
              id: 'con1',
              name: 'db-one',
              strategy: 'auth0',
              options: {
                custom_password_hash: {
                  action_id: 'action-id-1',
                },
              },
            },
          ]),
        clients: {
          get: (_connectionId: any, params: any) =>
            mockPagedData(params, 'connections', [{ client_id: 'client-id-1' }]),
        },
      },
      clients: {
        list: (params: any) =>
          mockPagedData(params, 'clients', [{ name: 'app-one', client_id: 'client-id-1' }]),
      },
      actions: {
        list: (params: any) =>
          mockPagedData(params, 'actions', [{ id: 'action-id-1', name: 'hash-action' }]),
      },
      pool,
    };

    const handler = new DatabasesHandler({ client: pageClient(auth0 as any), config } as any);

    const changes = await handler.dryRunChanges({
      databases: [
        {
          name: 'db-one',
          options: {
            custom_password_hash: {
              action_id: 'hash-action',
            },
          },
        },
      ],
    } as any);

    expect(changes.update).to.have.length(0);
  });

  it('actions should enrich module IDs during dry run', async () => {
    const auth0 = {
      actions: {
        list: (params: any) =>
          mockPagedData(params, 'actions', [
            {
              id: 'action-id-1',
              name: 'action-one',
              code: 'exports.onExecutePostLogin = async () => {};',
              supported_triggers: [{ id: 'post-login', version: 'v1' }],
              modules: [
                {
                  module_name: 'shared-module',
                  module_id: 'module-id-1',
                  module_version_number: 1,
                  module_version_id: 'module-version-id-1',
                },
              ],
            },
          ]),
        modules: {
          list: (params: any) =>
            mockPagedData(params, 'modules', [{ id: 'module-id-1', name: 'shared-module' }]),
          versions: {
            list: () =>
              Promise.resolve({
                data: [{ id: 'module-version-id-1', version_number: 1 }],
                hasNextPage: () => false,
                getNextPage: () => Promise.resolve({ data: [], hasNextPage: () => false }),
              }),
          },
        },
      },
      pool,
    };

    const handler = new ActionsHandler({ client: pageClient(auth0 as any), config } as any);

    const changes = await handler.dryRunChanges({
      actions: [
        {
          name: 'action-one',
          code: 'exports.onExecutePostLogin = async () => {};',
          supported_triggers: [{ id: 'post-login', version: 'v1' }],
          modules: [{ module_name: 'shared-module', module_version_number: 1 }],
        },
      ],
    } as any);

    expect(changes.update).to.have.length(0);
  });

  it('rules configs should treat dry run changes as updates', async () => {
    const handler = new RulesConfigsHandler({
      client: { rulesConfigs: { list: async () => [] } },
      config,
    } as any);

    const changes = await handler.dryRunChanges({
      rulesConfigs: [{ key: 'FOO', value: 'bar' }],
    } as any);

    expect(changes.create).to.have.length(0);
    expect(changes.del).to.have.length(0);
    expect(changes.update).to.deep.equal([{ key: 'FOO', value: 'bar' }]);
  });

  it('rules should honor exclusions during dry run', async () => {
    const rulesConfig = function (key: string) {
      return rulesConfig.data && rulesConfig.data[key];
    };

    rulesConfig.data = {
      AUTH0_ALLOW_DELETE: true,
      AUTH0_DRY_RUN: 'preview',
    } as Record<string, any>;

    const auth0 = {
      rules: {
        list: (params: any) =>
          mockPagedData(params, 'rules', [
            {
              id: 'rule-id-1',
              name: 'excluded-rule',
              order: 1,
              stage: 'login_success',
              enabled: true,
              script: 'function () {}',
            },
          ]),
      },
      pool,
    };

    const handler = new RulesHandler({
      client: pageClient(auth0 as any),
      config: rulesConfig,
    } as any);

    const changes = await handler.dryRunChanges({
      rules: [
        {
          name: 'excluded-rule',
          order: 1,
          stage: 'login_success',
          enabled: true,
          script: 'function () {}',
        },
      ],
      exclude: {
        rules: ['excluded-rule'],
      },
    } as any);

    expect(changes.create).to.have.length(0);
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(0);
  });

  it('hooks should not expose secret values in dry run updates', async () => {
    const auth0 = {
      hooks: {
        list: (params: any) =>
          mockPagedData(params, 'hooks', [
            {
              id: 'hook-id-1',
              name: 'hook-one',
              triggerId: 'credentials-exchange',
            },
          ]),
        get: async () => ({
          id: 'hook-id-1',
          name: 'hook-one',
          triggerId: 'credentials-exchange',
          script: 'module.exports = function(){}',
          enabled: true,
        }),
        secrets: {
          get: async () => ({ data: { SECRET_ONE: constants.HOOKS_HIDDEN_SECRET_VALUE } }),
        },
      },
      pool,
    };

    const handler = new HooksHandler({ client: pageClient(auth0 as any), config } as any);

    const changes = await handler.dryRunChanges({
      hooks: [
        {
          name: 'hook-one',
          triggerId: 'credentials-exchange',
          script: 'module.exports = function(){}',
          enabled: true,
          secrets: { SECRET_ONE: 'updated-secret' },
        },
      ],
    } as any);

    expect(changes.update).to.have.length(1);
    expect(changes.update[0].secrets).to.equal(undefined);
  });
});
