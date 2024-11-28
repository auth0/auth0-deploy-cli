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
  return params?.include_totals
    ? {
      data: {
        [key]: data,
        total: data?.length || 0,
      },
    }
    : {
      data,
    };
}

export function mockMgmtClient() {
  // Fake Mgmt Client. Bit hacky but good enough for now.
  return {
    rules: { getAll: (params) => mockPagedData(params, 'rules', []) },
    hooks: { getAll: (params) => mockPagedData(params, 'hooks', []) },
    actions: { getAll: () => mockPagedData({ include_totals: true }, 'actions', []) },
    databases: { getAll: (params) => mockPagedData(params, 'databases', []) },
    connections: { getAll: (params) => mockPagedData(params, 'connections', []) },
    resourceServers: { getAll: (params) => mockPagedData(params, 'resource_servers', []) },
    rulesConfigs: { getAll: (params) => mockPagedData(params, 'rules_configs', []) },
    emails: {
      get: () => ({
        data: {
          name: 'smtp',
          enabled: true,
        },
      }),
    },
    clientGrants: { getAll: (params) => mockPagedData(params, 'client_grants', []) },
    guardian: {
      getFactors: () => ({ data: [] }),
      getSmsFactorProviderTwilio: () => ({ data: [] }),
      getPushNotificationProviderSNS: () => ({ data: [] }),
      getSmsFactorTemplates: () => ({ data: [] }),
      getPhoneFactorMessageTypes: () => ({ data: { message_types: ['sms'] } }),
      getPhoneFactorSelectedProvider: () => ({ data: { provider: 'twilio' } }),
      getPolicies: () => ({ data: [] }),
    },
    emailTemplates: {
      get: (template) => ({
        data: {
          template: template.templateName,
          enabled: true,
          body: 'fake template',
        },
      }),
    },
    clients: {
      getAll: (params) => {
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
      getAll: (params) =>
        mockPagedData(params, 'roles', [
          {
            name: 'App Admin',
            id: 'myRoleId',
            description: 'Admin of app',
          },
        ]),
      getPermissions: (params) =>
        mockPagedData(params, 'permissions', [
          {
            permission_name: 'create:data',
            resource_server_identifier: 'urn:ref',
          },
        ]),
    },
    tenants: {
      getSettings: async () =>
        new Promise((res) =>
          res({
            data: {
              friendly_name: 'Test',
              default_directory: 'users',
              enabled_locales: ['en'],
            },
          })
        ),
      getCustomTextByLanguage: () => Promise.resolve({ data: {} }),
    },
    attackProtection: {
      getBreachedPasswordDetectionConfig: () => ({ data: {} }),
      getBruteForceConfig: () => ({ data: {} }),
      getSuspiciousIpThrottlingConfig: () => ({ data: {} }),
    },
    branding: {
      getSettings: () => ({ data: {} }),
      getDefaultTheme: () => {
        const err = new Error('Not found');
        err.statusCode = 404;
        return Promise.reject(err);
      },
    },
    logStreams: { getAll: (params) => mockPagedData(params, 'log_streams', []) },
    prompts: {
      _getRestClient: (endpoint) => ({
        get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
      }),
      getCustomTextByLanguage: () =>
        new Promise((res) => {
          res({ data: {} });
        }),
      get: () => ({ data: {} }),
    },
    customDomains: { getAll: (params) => mockPagedData(params, 'custom_domains', []) },
    forms: { getAll: (params) => mockPagedData(params, 'forms', []) },
    flows: {
      getAll: (params) => mockPagedData(params, 'flows', []),
      getAllConnections: (params) => mockPagedData(params, 'connections', []),
    },
    selfServiceProfiles: {
      getAll: (params) => mockPagedData(params, 'selfServiceProfiles', []),
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
