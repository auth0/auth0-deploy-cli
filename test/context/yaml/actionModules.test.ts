import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/actionModules';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context actionModules', () => {
  it('should process action modules', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionModule-one');
    cleanThenMkdir(dir);

    const codeContext = 'module.exports = { test: @@replace@@ };';
    const codeFile = path.join(dir, 'code.js');
    fs.writeFileSync(codeFile, codeContext);

    const yaml = `
    actionModules:
      - name: module-one
        code: "${codeFile}"
        dependencies:
          - name: lodash
            version: 4.17.21
        secrets: []
    `;
    const yamlFile = path.join(dir, 'module-one.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        name: 'module-one',
        code: 'module.exports = { test: "test-value" };',
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.21',
          },
        ],
        secrets: [],
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { replace: 'test-value' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actionModules).to.deep.equal(target);
  });

  it('should dump action modules', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionModulesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') },
      mockMgmtClient()
    );
    const codeValidation = 'module.exports = { test: "test-value" };';

    context.assets.actionModules = [
      {
        name: 'module-one',
        code: codeValidation,
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.21',
          },
        ],
        secrets: [],
        actions_using_module_total: 0,
        all_changes_published: true,
        latest_version_number: 1,
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      actionModules: [
        {
          name: 'module-one',
          code: './action-modules/module-one/code.js',
          dependencies: [
            {
              name: 'lodash',
              version: '4.17.21',
            },
          ],
          secrets: [],
          actions_using_module_total: 0,
          all_changes_published: true,
          latest_version_number: 1,
        },
      ],
    });

    const modulesFolder = path.join(dir, 'action-modules', 'module-one');
    expect(fs.readFileSync(path.join(modulesFolder, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should dump action modules with identifiers when AUTH0_EXPORT_IDENTIFIERS is true', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionModulesDumpWithId');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml'), AUTH0_EXPORT_IDENTIFIERS: true },
      mockMgmtClient()
    );
    const codeValidation = 'module.exports = { test: "test-value" };';

    context.assets.actionModules = [
      {
        id: 'mod_123',
        name: 'module-one',
        code: codeValidation,
        dependencies: [],
        secrets: [],
        actions_using_module_total: 0,
        all_changes_published: true,
        latest_version_number: 1,
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      actionModules: [
        {
          id: 'mod_123',
          name: 'module-one',
          code: './action-modules/module-one/code.js',
          dependencies: [],
          secrets: [],
          actions_using_module_total: 0,
          all_changes_published: true,
          latest_version_number: 1,
        },
      ],
    });

    const modulesFolder = path.join(dir, 'action-modules', 'module-one');
    expect(fs.readFileSync(path.join(modulesFolder, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should process action modules with @@KEYWORD@@ format in secrets', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionModule-secrets');
    cleanThenMkdir(dir);

    const codeContext = 'module.exports = { auth: true };';
    const codeFile = path.join(dir, 'code.js');
    fs.writeFileSync(codeFile, codeContext);

    const yaml = `
    actionModules:
      - name: secure-module
        code: "${codeFile}"
        dependencies: []
        secrets:
          - name: API_KEY
            value: @@API_KEY_VALUE@@
          - name: CLIENT_SECRET
            value: @@CLIENT_SECRET_VALUE@@
    `;
    const yamlFile = path.join(dir, 'secure-module.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        name: 'secure-module',
        code: 'module.exports = { auth: true };',
        dependencies: [],
        secrets: [
          {
            name: 'API_KEY',
            value: 'prod-api-key-xyz',
          },
          {
            name: 'CLIENT_SECRET',
            value: 'prod-client-secret-abc',
          },
        ],
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        API_KEY_VALUE: 'prod-api-key-xyz',
        CLIENT_SECRET_VALUE: 'prod-client-secret-abc',
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actionModules).to.deep.equal(target);
  });

  it('should process action modules with ##KEYWORD## format in secrets', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionModule-hash-keywords');
    cleanThenMkdir(dir);

    const codeContext = 'module.exports = { config: "##CONFIG_VALUE##" };';
    const codeFile = path.join(dir, 'code.js');
    fs.writeFileSync(codeFile, codeContext);

    const yaml = `
    actionModules:
      - name: hash-keyword-module
        code: "${codeFile}"
        dependencies:
          - name: ##LIBRARY_NAME##
            version: ##LIBRARY_VERSION##
        secrets:
          - name: AWS_KEY
            value: ##AWS_ACCESS_KEY##
          - name: AWS_SECRET
            value: ##AWS_SECRET_KEY##
    `;
    const yamlFile = path.join(dir, 'hash-keyword-module.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        name: 'hash-keyword-module',
        code: 'module.exports = { config: "production" };',
        dependencies: [
          {
            name: 'aws-sdk',
            version: '2.1400.0',
          },
        ],
        secrets: [
          {
            name: 'AWS_KEY',
            value: 'AKIAIOSFODNN7EXAMPLE',
          },
          {
            name: 'AWS_SECRET',
            value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          },
        ],
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        CONFIG_VALUE: 'production',
        LIBRARY_NAME: 'aws-sdk',
        LIBRARY_VERSION: '2.1400.0',
        AWS_ACCESS_KEY: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actionModules).to.deep.equal(target);
  });
});
