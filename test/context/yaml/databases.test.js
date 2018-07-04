import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/yaml';
import { writeStringToFile, testDataDir, cleanThenMkdir } from 'test/utils';

describe('#context YAML databases', () => {
  it('should process database', async () => {
    const dir = path.join(testDataDir, 'yaml', 'databases');
    cleanThenMkdir(dir);

    const scriptContent = 'function login() { var ##val1## = @@val2@@; }';
    const scriptFile = writeStringToFile(path.join(dir, 'script.js'), scriptContent);

    const yaml = `
    databases:
      - name: "db1"
        options:
          enabledDatabaseCustomization: true
        scripts:
          login: ${scriptFile}
          create: ${scriptFile}
          delete: ${scriptFile}
          change_email: ${scriptFile}
          get_user: ${scriptFile}
          verify: ${scriptFile}
    `;

    const target = [
      {
        name: 'db1',
        options: {
          enabledDatabaseCustomization: true
        },
        scripts: {
          login: {
            scriptFile: ''
          },
          create: {
            scriptFile: 'function create() { }'
          },
          delete: {
            scriptFile: 'function delete() { }'
          },
          verify: {
            scriptFile: 'function delete() { }'
          },
          change_email: {
            scriptFile: 'function change_email() { }'
          },
          get_user: {
            scriptFile: 'function get_user() { }'
          }
        }
      }
    ];

    const yamlFile = writeStringToFile(path.join(dir, 'databases.yaml'), yaml);
    const context = new Context(yamlFile, { val1: 'env1', val2: 'env2' });
    await context.init();
    const scriptValidate = 'function login() { var env1 = "env2"; }';
    target[0].scripts.login.scriptFile = scriptValidate;
    target[0].scripts.create.scriptFile = scriptValidate;
    target[0].scripts.delete.scriptFile = scriptValidate;
    target[0].scripts.change_email.scriptFile = scriptValidate;
    target[0].scripts.get_user.scriptFile = scriptValidate;
    target[0].scripts.verify.scriptFile = scriptValidate;
    expect(context.databases).to.deep.equal(target);
  });
});
