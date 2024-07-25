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

export function mockMgmtClient() {
  // Fake Mgmt Client. Bit hacky but good enough for now.
  return {
    rules: { getAll: () => ({ rules: [] }) },
    hooks: { getAll: () => ({ hooks: [] }) },
    actions: { getAll: () => ({ actions: [] }) },
    databases: { getAll: () => ({ databases: [] }) },
    connections: { getAll: () => ({ connections: [] }) },
    resourceServers: { getAll: () => ({ resourceServers: [] }) },
    rulesConfigs: { getAll: () => ({ rulesConfigs: [] }) },
    emailProvider: {
      get: () => ({
        name: 'smtp',
        enabled: true,
      }),
    },
    clientGrants: { getAll: () => ({ clientGrants: [] }) },
    guardian: {
      getFactors: () => [],
      getFactorProvider: () => [],
      getFactorTemplates: () => [],
      getPhoneFactorMessageTypes: () => ({ message_types: ['sms'] }),
      getPhoneFactorSelectedProvider: () => ({ provider: 'twilio' }),
      getPolicies: () => [],
    },
    emailTemplates: {
      get: (template) => ({
        template: template.name,
        enabled: true,
        body: 'fake template',
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

        if (params.per_page) {
          return {
            clients: [client],
          };
        }

        return [client];
      },
    },
    roles: {
      getAll: () => ({
        roles: [
          {
            name: 'App Admin',
            id: 'myRoleId',
            description: 'Admin of app',
          },
        ],
        total: 1,
        limit: 50,
      }),
      permissions: {
        getAll: () => ({
          permissions: [
            {
              permission_name: 'create:data',
              resource_server_identifier: 'urn:ref',
            },
          ],
          total: 1,
          limit: 50,
        }),
      },
    },
    tenant: {
      getSettings: async () =>
        new Promise((res) =>
          res({
            friendly_name: 'Test',
            default_directory: 'users',
            enabled_locales: ['en'],
          })
        ),
      getCustomTextByLanguage: () => Promise.resolve({}),
    },
    migrations: {
      getMigrations: () => ({
        migration_flag: true,
      }),
    },
    attackProtection: {
      getBreachedPasswordDetectionConfig: () => ({}),
      getBruteForceConfig: () => ({}),
      getSuspiciousIpThrottlingConfig: () => ({}),
    },
    branding: {
      getSettings: () => ({}),
      getDefaultTheme: () => {
        const err = new Error('Not found');
        err.statusCode = 404;
        return Promise.reject(err);
      },
    },
    logStreams: { getAll: () => [] },
    prompts: {
      getCustomTextByLanguage: () =>
        new Promise((res) => {
          res({});
        }),
      getSettings: () => { },
    },
    customDomains: { getAll: () => [] },
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
            throw new TypeError(`Expected content to be a string, but received ${typeof fileContent}`);
          }
          fs.writeFileSync(filePath, fileContent);
        });
      } else {
        throw new TypeError(`Expected content to be a string or object, but received ${typeof content}`);
      }
    });
  });
}
