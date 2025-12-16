import path from 'path';
import fs from 'fs-extra';
import rmdirSync from 'rmdir-sync';
import mkdirp from 'mkdirp';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import log from '../src/logger';

log.level = 'debug';

chai.use(chaiAsPromised);

export const localDir = 'local';
export const testDataDir = path.resolve(localDir, 'testData');

export function mockPagedData(params, key, data) {
  // SDK v5 Page<T> always returns data as an array, with total as a separate property
  const pagedResponse = {
    data,
    hasNextPage: () => false,
    getNextPage: () =>
      Promise.resolve({
        data: [],
        hasNextPage: () => false,
        getNextPage: () => Promise.resolve({ data: [], hasNextPage: () => false }),
      }),
  };

  if (params && params.include_totals) {
    pagedResponse.total = data.length || 0;
    return pagedResponse;
  }

  return pagedResponse;
}

export function mockMgmtClient() {
  // Fake Mgmt Client. Bit hacky but good enough for now.
  return {
    rules: { list: (params) => mockPagedData(params, 'rules', []) },
    hooks: { list: (params) => mockPagedData(params, 'hooks', []) },
    actions: {
      list: () => mockPagedData({ include_totals: true }, 'actions', []),
      triggers: {
        list: () => {},
        bindings: {
          list: (_triggerId) => Promise.resolve({ data: [] }),
        },
      },
    },
    databases: { list: (params) => mockPagedData(params, 'databases', []) },
    connections: { list: (params) => mockPagedData(params, 'connections', []) },
    resourceServers: { list: (params) => mockPagedData(params, 'resource_servers', []) },
    rulesConfigs: { list: (params) => mockPagedData(params, 'rules_configs', []) },
    emails: {
      provider: {
        get: () => ({
          name: 'smtp',
          enabled: true,
        }),
      },
    },
    clientGrants: { list: (params) => mockPagedData(params, 'client_grants', []) },
    guardian: {
      factors: {
        list: () => [],
        sms: {
          getTwilioProvider: () => [],
          getTemplates: () => [],
          getSelectedProvider: () => ({ provider: 'twilio' }),
        },
        phone: {
          getMessageTypes: () => ({ message_types: ['sms'] }),
          getSelectedProvider: () => ({ provider: 'twilio' }),
        },
        pushNotification: {
          getSnsProvider: () => [],
        },
      },
      policies: {
        list: () => [],
      },
    },
    emailTemplates: {
      get: (template) => {
        const templateName = typeof template === 'string' ? template : template.templateName;

        return {
          template: templateName,
          enabled: true,
          body: 'fake template',
        };
      },
    },
    clients: {
      list: (params) => {
        const client = {
          name: 'Global Client',
          client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV',
          client_secret: 'dummy_client_secret',
          custom_login_page_on: true,
          custom_login_page: '<html>page</html>',
        };

        return mockPagedData(params, 'clients', [client]);
      },
    },
    roles: {
      list: (params) =>
        mockPagedData(params, 'roles', [
          {
            name: 'App Admin',
            id: 'myRoleId',
            description: 'Admin of app',
          },
        ]),
      permissions: {
        list: (params) =>
          mockPagedData(params, 'permissions', [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref',
            },
          ]),
      },
    },
    tenants: {
      settings: {
        get: () =>
          new Promise((resolve) => {
            resolve({
              friendly_name: 'Test',
              default_directory: 'users',
              enabled_locales: ['en'],
            });
          }),
      },
      getCustomTextByLanguage: () => Promise.resolve({}),
    },
    attackProtection: {
      breachedPasswordDetection: {
        get: () => ({}),
      },
      bruteForceProtection: {
        get: () => ({}),
      },
      suspiciousIpThrottling: {
        get: () => ({}),
      },
    },
    branding: {
      get: () => ({}),
      themes: {
        getDefault: () => {
          const err = new Error('Not found');
          err.statusCode = 404;
          return Promise.reject(err);
        },
      },
      phone: {
        providers: {
          list: () => Promise.resolve({ providers: [] }),
          get: (_id) => Promise.resolve({}),
          create: (data) => Promise.resolve(data),
          update: (_id, data) => Promise.resolve(data),
          delete: (_id) => Promise.resolve(),
        },
        templates: {
          list: () => Promise.resolve({ templates: [] }),
          create: (data) => Promise.resolve(data),
          update: (_id, data) => Promise.resolve(data),
          delete: (_id) => Promise.resolve(),
        },
      },
    },
    logStreams: { list: () => Promise.resolve([]) },
    prompts: {
      customText: {
        get: (_promptType, _language, _options) => Promise.resolve({}),
      },
      partials: {
        get: (_prompt, _options) => Promise.resolve({}),
      },
      rendering: {
        list: () => Promise.resolve({ data: [] }),
      },
      getSettings: () => Promise.resolve(Object.create(null)),
      updateSettings: () => Promise.resolve({}),
    },
    customDomains: {
      list: (params) => mockPagedData(params, 'customDomains', []),
    },
    forms: { list: (params) => mockPagedData(params, 'forms', []) },
    flows: {
      list: (params) => mockPagedData(params, 'flows', []),
      vault: {
        connections: {
          list: (params) => mockPagedData(params, 'connections', []),
        },
      },
    },
    selfServiceProfiles: {
      list: (params) => mockPagedData(params, 'selfServiceProfiles', []),
    },
    networkAcls: {
      list: (params) => mockPagedData(params, 'network_acls', []),
    },
    organizations: {
      list: (params) => mockPagedData(params, 'organizations', []),
      enabledConnections: {
        list: (_orgId, params) => mockPagedData(params, 'enabled_connections', []),
      },
      clientGrants: {
        list: (_orgId, params) => mockPagedData(params, 'client_grants', []),
      },
    },
    userAttributeProfiles: {
      list: (params) => mockPagedData(params, 'userAttributeProfiles', []),
    },
    connectionProfiles: {
      list: (params) => mockPagedData(params, 'connectionProfiles', []),
    },
    tokenExchangeProfiles: {
      list: (params) => mockPagedData(params, 'tokenExchangeProfiles', []),
    },
  };
}

export function cleanThenMkdir(dir) {
  try {
    rmdirSync(dir);
  } catch (err) {
    log.error(err);
  }
  mkdirp.sync(dir);
}

export function createDir(repoDir, files) {
  Object.keys(files).forEach((type) => {
    const configDir = path.resolve(repoDir, type);
    cleanThenMkdir(configDir);
    Object.entries(files[type]).forEach(([name, content]) => {
      const filePath = path.join(configDir, name);
      fs.writeFileSync(filePath, content);
    });
  });
}

export function createDirWithNestedDir(repoDir, files) {
  Object.keys(files).forEach((type) => {
    const typeDir = path.resolve(repoDir, type);
    cleanThenMkdir(typeDir);

    Object.entries(files[type]).forEach(([subtype, content]) => {
      const subtypeDir = path.join(typeDir, subtype);

      if (typeof content === 'string') {
        fs.writeFileSync(subtypeDir, content);
      } else if (typeof content === 'object') {
        cleanThenMkdir(subtypeDir);
        Object.entries(content).forEach(([fileName, fileContent]) => {
          const filePath = path.join(subtypeDir, fileName);
          if (typeof fileContent !== 'string') {
            throw new TypeError(
              `Expected content to be a string, but received ${typeof fileContent}`
            );
          }
          fs.writeFileSync(filePath, fileContent);
        });
      } else {
        throw new TypeError(
          `Expected content to be a string or object, but received ${typeof content}`
        );
      }
    });
  });
}
