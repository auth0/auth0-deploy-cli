import { expect } from 'chai';
import pageClient from '../../../../src/tools/auth0/client';
import ActionsHandler from '../../../../src/tools/auth0/handlers/actions';
import ConnectionsHandler from '../../../../src/tools/auth0/handlers/connections';
import DatabasesHandler from '../../../../src/tools/auth0/handlers/databases';
import HooksHandler from '../../../../src/tools/auth0/handlers/hooks';
import RulesConfigsHandler from '../../../../src/tools/auth0/handlers/rulesConfigs';
import RulesHandler from '../../../../src/tools/auth0/handlers/rules';
import DefaultHandler from '../../../../src/tools/auth0/handlers/default';
import constants from '../../../../src/tools/constants';
import { configFactory } from '../../../../src/configFactory';
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

describe('#getResourceName', () => {
  function createHandler(type: string): DefaultHandler {
    return new DefaultHandler({
      // @ts-ignore test stub
      config: configFactory(),
      type,
      id: 'id',
      identifiers: ['id', 'name'],
    });
  }

  it('should return name when present', () => {
    const handler = createHandler('clients');
    expect(handler.getResourceName({ name: 'My App' })).to.equal('My App');
  });

  it('should return display_name when name is absent', () => {
    const handler = createHandler('clients');
    expect(handler.getResourceName({ display_name: 'My Display Name' })).to.equal(
      'My Display Name'
    );
  });

  it('should return template when name and display_name are absent', () => {
    const handler = createHandler('emailTemplates');
    expect(handler.getResourceName({ template: 'verify_email' })).to.equal('verify_email');
  });

  it('should return email property as fallback', () => {
    const handler = createHandler('users');
    expect(handler.getResourceName({ email: 'test@example.com' })).to.equal('test@example.com');
  });

  it('should format clientGrants as "client_id -> audience"', () => {
    const handler = createHandler('clientGrants');
    expect(
      handler.getResourceName({ client_id: 'cli_123', audience: 'https://api.example.com' })
    ).to.equal('cli_123 -> https://api.example.com');
  });

  it('should return name or type for guardianFactors', () => {
    const handler = createHandler('guardianFactors');
    expect(handler.getResourceName({ type: 'sms' })).to.equal('sms');
  });

  it('should return template for emailTemplates type when no name', () => {
    const handler = createHandler('emailTemplates');
    expect(handler.getResourceName({ template: 'welcome_email' })).to.equal('welcome_email');
  });

  it('should return description or priority for networkACLs', () => {
    const handler = createHandler('networkACLs');
    expect(handler.getResourceName({ description: 'Block list' })).to.equal('Block list');
    expect(handler.getResourceName({ priority: 10 })).to.equal('priority:10');
  });

  it('should return domain for customDomains', () => {
    const handler = createHandler('customDomains');
    expect(handler.getResourceName({ domain: 'auth.example.com' })).to.equal('auth.example.com');
  });

  it('should return "{type} settings" for singleton resource types', () => {
    const singletonTypes = [
      'tenant',
      'attackProtection',
      'branding',
      'emailProvider',
      'guardianPhoneFactorSelectedProvider',
      'guardianPolicies',
      'riskAssessment',
    ];
    singletonTypes.forEach((type) => {
      const handler = createHandler(type);
      expect(handler.getResourceName({})).to.equal(`${type} settings`);
    });
  });

  it('should return "unnamed resource" as fallback', () => {
    const handler = createHandler('unknownType');
    expect(handler.getResourceName({})).to.equal('unnamed resource');
  });
});
