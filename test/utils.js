import fs from 'fs-extra';
import _ from 'lodash';
import rmdirSync from 'rmdir-sync';
import path from 'path';
import mkdirp from 'mkdirp';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import log from '../src/logger';
import dirContext from '../src/context/directory';
import yamlContext from '../src/context/yaml';
import { loadJSON } from '../src/utils';

log.transports.console.level = 'debug';

chai.use(chaiAsPromised);

export const localDir = 'local';
export const testDataDir = path.resolve(localDir, 'testData');


export function mockMgmtClient() {
  // Fake Mgmt Client. Bit hacky but good enough for now.
  return {
    rules: { getAll: () => ({ rules: [] }) },
    hooks: { getAll: () => [] },
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
        get: () => [
          {
            permission_name: 'create:data', resource_server_identifier: 'urn:ref'
          }
        ]
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

function createContext(format, config) {
  if (format.name === 'directory') {
    return new dirContext(config, mockMgmtClient());
  } else if (format.name === 'yaml') {
    return new yamlContext(config, mockMgmtClient());
  }
  throw new Error('unsupported format');
}

function getInputConfig(format, repoDir, content) {
  if (format.name === 'directory') {
    return { AUTH0_INPUT_FILE: repoDir };
  }
  const inputFile = path.join(repoDir, 'main.' + format.name);
  if (content) {
    fs.writeFileSync(inputFile, content);
  }
  return { AUTH0_INPUT_FILE: inputFile };
}

async function caseValidateImport(format, testSpec) {
  const spec = _.cloneDeep(testSpec);
  const importSpec = spec.import[format.name];
  const files = { [spec.subDir]: importSpec.files || {} };
  const repoDir = fs.mkdtempSync(path.join(testDataDir, format.name + '-'));
  createDir(repoDir, files);

  const config = { ...getInputConfig(format, repoDir, importSpec.content), ...spec.env };
  const context = createContext(format, config);
  await context.load();
  rmdirSync(repoDir);

  expect(_.orderBy(context.assets[spec.handlerType], [ 'name' ])).to.deep.equal(_.orderBy(spec.import.expected, [ 'name' ]));
}

async function caseValidateImportIgnoreUnknown(format, testSpec) {
  const spec = _.cloneDeep(testSpec);
  const extraFileContents = {
    'README.md': 'something'
  };
  spec.import[format.name].files = {
    ...(spec.import[format.name].files || {}),
    ...extraFileContents
  };

  await caseValidateImport(format, spec);
}

async function caseValidateImportIgnoreNonDirectoryInput(format, testSpec) {
  const spec = _.cloneDeep(testSpec);
  const repoDir = fs.mkdtempSync(path.join(testDataDir, format.name + '-'));
  cleanThenMkdir(repoDir);
  const dir = path.join(repoDir, spec.subDir);
  fs.writeFileSync(dir, 'junk');

  const config = { AUTH0_INPUT_FILE: repoDir, ...spec.env };
  const context = createContext(format, config);
  const errorMessage = `Expected ${dir} to be a folder but got a file?`;
  await expect(context.load())
    .to.be.eventually.rejectedWith(Error)
    .and.have.property('message', errorMessage);

  rmdirSync(repoDir);
}

async function caseValidateExport(format, testSpec) {
  const spec = _.cloneDeep(testSpec);
  const dir = fs.mkdtempSync(path.join(testDataDir, format.name + '-'));
  const context = createContext(format, getInputConfig(format, dir, null));
  const typeFolder = path.join(dir, spec.subDir);
  context.assets[spec.handlerType] = _.cloneDeep(spec.export.json);
  if (spec.clients) {
    if (format.name === 'directory') {
      // FIXME: The implementation should be fixed
      context.assets.clientsOrig = _.cloneDeep(spec.clients);
    } else {
      context.assets.clients = _.cloneDeep(spec.clients);
    }
  }
  const dumped = await format.handler.dump(context);

  if (spec.export.expected[format.name].json) {
    expect(dumped).to.deep.equal({
      [spec.handlerType]: spec.export.expected[format.name].json
    });
  }

  const expectedFiles = spec.export.expected[format.name].files;
  if (expectedFiles && expectedFiles.length) {
    expectedFiles.forEach((f) => {
      if (f.contentType === 'json') {
        expect(loadJSON(path.join(typeFolder, f.fileName))).to.deep.equal(f.content);
      } else {
        expect(fs.readFileSync(path.join(typeFolder, f.fileName), 'utf8')).to.deep.equal(f.content);
      }
    });
  } else {
    expect(fs.pathExistsSync(typeFolder)).to.be.false;
  }
  rmdirSync(dir);
}

async function caseValidateExportUndefined(format, testSpec) {
  const spec = _.cloneDeep(testSpec);
  if (format.name === 'directory') {
    delete spec.export.json;
  } else {
    spec.export.json = [];
    spec.export.expected[format.name].json = [];
  }
  spec.export.expected[format.name].files = [];
  await caseValidateExport(format, spec);
}

export function getStandardTests(format) {
  const tests = [
    {
      name: 'should process import',
      func: caseValidateImport
    },
    {
      name: 'should ignore unknown file',
      func: caseValidateImportIgnoreUnknown
    },
    {
      name: 'should export with snaitized file name',
      func: caseValidateExport
    },
    {
      name: 'should skip undefined assets',
      func: caseValidateExportUndefined
    }
  ];
  if (format.name === 'directory') {
    tests.push({
      name: 'should ignore non-directory input',
      func: caseValidateImportIgnoreNonDirectoryInput
    });
  }
  return tests.map(test => ({
    name: format.name + ' - ' + test.name,
    func: test.func
  }));
}
