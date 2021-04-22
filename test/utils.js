import fs from 'fs-extra';
import rmdirSync from 'rmdir-sync';
import path from 'path';
import mkdirp from 'mkdirp';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import log from '../src/logger';

log.transports.console.level = 'debug';

chai.use(chaiAsPromised);

export const localDir = 'local';
export const testDataDir = path.resolve(localDir, 'testData');

export function mockMgmtClient() {
  // Fake Mgmt Client. Bit hacky but good enough for now.
  return {
    rules: { getAll: () => ({ rules: [] }) },
    hooks: { getAll: () => [] },
    actions: { getAll: () => ({ actions: [] }) },
    databases: { getAll: () => ({ databases: [] }) },
    connections: { getAll: () => ({ connections: [] }) },
    resourceServers: { getAll: () => ({ resourceServers: [] }) },
    rulesConfigs: { getAll: () => ({ rulesConfigs: [] }) },
    emailProvider: {
      get: () => ({
        name: 'smtp',
        enabled: true
      })
    },
    clientGrants: { getAll: () => ({ clientGrants: [] }) },
    guardian: {
      getFactors: () => [],
      getFactorProvider: () => [],
      getFactorTemplates: () => [],
      getPhoneFactorMessageTypes: () => ({ message_types: [ 'sms' ] }),
      getPhoneFactorSelectedProvider: () => ({ provider: 'twilio' }),
      getPolicies: () => []
    },
    emailTemplates: {
      get: template => ({
        template: template.name,
        enabled: true,
        body: 'fake template'
      })
    },
    clients: {
      getAll: (params) => {
        const client = {
          name: 'Global Client', client_id: 'FMfcgxvzLDvPsgpRFKkLVrnKqGgkHhQV', client_secret: 'dummy_client_secret', custom_login_page_on: true, custom_login_page: '<html>page</html>'
        };

        if (params.per_page) {
          return {
            clients: [ client ]
          };
        }

        return [ client ];
      }
    },
    roles: {
      getAll: () => (
        {
          roles: [
            {
              name: 'App Admin',
              id: 'myRoleId',
              description: 'Admin of app'
            }
          ],
          total: 1,
          limit: 50
        }
      ),
      permissions: {
        getAll: () => (
          {
            permissions: [
              {
                permission_name: 'create:data', resource_server_identifier: 'urn:ref'
              }
            ],
            total: 1,
            limit: 50
          }
        )
      }
    },
    tenant: {
      getSettings: () => ({
        friendly_name: 'Test',
        default_directory: 'users'
      })
    },
    migrations: {
      getMigrations: () => ({
        migration_flag: true
      })
    }
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
    Object.entries(files[type]).forEach(([ name, content ]) => {
      fs.writeFileSync(path.join(configDir, name), content);
    });
  });
}
