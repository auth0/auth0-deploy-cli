import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/databases';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context databases', () => {
  const dbDir = path.join(testDataDir, 'yaml', 'databases');
  const scriptContent = 'function login() { var ##val1## = @@val2@@; }';
  const scriptFile = path.join(dbDir, 'script.js');
  const scriptValidate = 'function login() { var env1 = "env2"; }';
  const yamlFile = path.join(dbDir, 'databases.yaml');
  const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { val1: 'env1', val2: 'env2' } };

  it('should process normal database', async () => {
    cleanThenMkdir(dbDir);

    fs.writeFileSync(scriptFile, scriptContent);

    const yaml = `
    databases:
      - name: "users"
        options:
          import_mode: true
          requires_username: true
    `;

    const target = [
      {
        name: 'users',
        options: {
          import_mode: true,
          requires_username: true
        },
        strategy: 'auth0'
      }
    ];

    fs.writeFileSync(yamlFile, yaml);

    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.databases).to.deep.equal(target);
  });

  it('should process custom database', async () => {
    cleanThenMkdir(dbDir);

    fs.writeFileSync(scriptFile, scriptContent);

    const yaml = `
    databases:
      - name: "users"
        options:
          import_mode: true
          enabledDatabaseCustomization: true
          customScripts:
            login: ${scriptFile}
            create: ${scriptFile}
            delete: ${scriptFile}
            get_user: ${scriptFile}
            change_email: ${scriptFile}
            change_password: ${scriptFile}
            verify: ${scriptFile}
    `;

    const target = [
      {
        name: 'users',
        options: {
          import_mode: true,
          customScripts: {
            change_email: scriptValidate,
            change_password: scriptValidate,
            create: scriptValidate,
            delete: scriptValidate,
            get_user: scriptValidate,
            login: scriptValidate,
            verify: scriptValidate
          },
          enabledDatabaseCustomization: true
        },
        strategy: 'auth0'
      }
    ];

    fs.writeFileSync(yamlFile, yaml);

    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.databases).to.deep.equal(target);
  });

  const dbDumpDir = path.join(testDataDir, 'yaml', 'databasesDump');

  it('should dump normal databases', async () => {
    cleanThenMkdir(dbDumpDir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dbDumpDir, 'tennat.yaml') }, mockMgmtClient());

    context.assets.databases = [
      {
        name: 'users',
        enabled_clients: [],
        options: {
          import_mode: true,
          requires_username: true
        },
        strategy: 'auth0'
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      databases: [
        {
          name: 'users',
          enabled_clients: [],
          options: {
            import_mode: true,
            requires_username: true
          },
          strategy: 'auth0'
        }
      ]
    });
  });

  it('should dump custom databases', async () => {
    cleanThenMkdir(dbDumpDir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dbDumpDir, 'tennat.yaml') }, mockMgmtClient());

    context.assets.databases = [
      {
        name: 'users',
        enabled_clients: [],
        options: {
          import_mode: true,
          customScripts: {
            change_email: scriptValidate,
            change_password: scriptValidate,
            create: scriptValidate,
            delete: scriptValidate,
            get_user: scriptValidate,
            login: scriptValidate,
            verify: scriptValidate
          },
          enabledDatabaseCustomization: true
        },
        strategy: 'auth0'
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      databases: [
        {
          name: 'users',
          enabled_clients: [],
          options: {
            import_mode: true,
            customScripts: {
              change_email: './databases/users/change_email.js',
              change_password: './databases/users/change_password.js',
              create: './databases/users/create.js',
              delete: './databases/users/delete.js',
              get_user: './databases/users/get_user.js',
              login: './databases/users/login.js',
              verify: './databases/users/verify.js'
            },
            enabledDatabaseCustomization: true
          },
          strategy: 'auth0'
        }
      ]
    });

    const scripsFolder = path.join(dbDumpDir, 'databases', 'users');
    expect(fs.readFileSync(path.join(scripsFolder, 'change_email.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'change_password.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'create.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'delete.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'get_user.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'login.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'verify.js'), 'utf8')).to.deep.equal(scriptValidate);
  });

  it('should dump custom databases sanitized', async () => {
    cleanThenMkdir(dbDumpDir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dbDumpDir, 'tennat.yaml') }, mockMgmtClient());

    context.assets.databases = [
      {
        name: 'users/test',
        enabled_clients: [ 'client3', 'client2', 'client1' ],
        options: {
          import_mode: true,
          customScripts: {
            change_email: scriptValidate
          },
          enabledDatabaseCustomization: true
        },
        strategy: 'auth0'
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      databases: [
        {
          name: 'users/test',
          enabled_clients: [ 'client1', 'client2', 'client3' ],
          options: {
            import_mode: true,
            customScripts: {
              change_email: './databases/users-test/change_email.js'
            },
            enabledDatabaseCustomization: true
          },
          strategy: 'auth0'
        }
      ]
    });

    const scripsFolder = path.join(dbDumpDir, 'databases', 'users-test');
    expect(fs.readFileSync(path.join(scripsFolder, 'change_email.js'), 'utf8')).to.deep.equal(scriptValidate);
  });
});
