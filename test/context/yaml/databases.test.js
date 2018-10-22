import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/databases';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context databases', () => {
  it('should process database', async () => {
    const dir = path.join(testDataDir, 'yaml', 'databases');
    cleanThenMkdir(dir);

    const scriptContent = 'function login() { var ##val1## = @@val2@@; }';
    const scriptFile = path.join(dir, 'script.js');
    fs.writeFileSync(scriptFile, scriptContent);

    const yaml = `
    databases:
      - name: "users"
        options:
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

    const scriptValidate = 'function login() { var env1 = "env2"; }';

    const target = [
      {
        name: 'users',
        options: {
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

    const yamlFile = path.join(dir, 'databases.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { val1: 'env1', val2: 'env2' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.databases).to.deep.equal(target);
  });

  it('should dump databases', async () => {
    const dir = path.join(testDataDir, 'yaml', 'databasesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') }, mockMgmtClient());

    const scriptValidate = 'function login() { var env1 = "env2"; }';
    context.assets.databases = [
      {
        name: 'users',
        options: {
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
          options: {
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

    const scripsFolder = path.join(dir, 'databases', 'users');
    expect(fs.readFileSync(path.join(scripsFolder, 'change_email.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'change_password.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'create.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'delete.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'get_user.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'login.js'), 'utf8')).to.deep.equal(scriptValidate);
    expect(fs.readFileSync(path.join(scripsFolder, 'verify.js'), 'utf8')).to.deep.equal(scriptValidate);
  });
});
