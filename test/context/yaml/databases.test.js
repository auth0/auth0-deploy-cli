import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context YAML databases', () => {
  it('should process database', async () => {
    const dir = path.join(testDataDir, 'yaml', 'databases');
    cleanThenMkdir(dir);

    const scriptContent = 'function login() { var ##val1## = @@val2@@; }';
    const scriptFile = writeStringToFile(path.join(dir, 'script.js'), scriptContent);

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

    const yamlFile = writeStringToFile(path.join(dir, 'databases.yaml'), yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { val1: 'env1', val2: 'env2' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.databases).to.deep.equal(target);
  });
});
