import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/actionModules';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

const actionModuleFiles = {
  [constants.ACTION_MODULES_DIRECTORY]: {
    'code.js': 'module.exports = { test: @@replace@@ };',
    'module-one.json': `{
      "name": "module-one",
      "code": "./action-modules/code.js",
      "dependencies": [
        {
          "name": "lodash",
          "version": "4.17.21"
        }
      ],
      "secrets": []
    }`,
  },
};

const actionModulesTarget = [
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

describe('#directory context actionModules', () => {
  it('should process action modules', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'actionModules1');
    createDir(repoDir, actionModuleFiles);
    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { replace: 'test-value' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actionModules).to.deep.equal(actionModulesTarget);
  });

  it('should process action modules when code is stored in path relative to input file', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'actionModules2');
    const files = {
      'separate-directory': {
        'module-code.js': 'module.exports = { test: "test-value" };',
      },
      [constants.ACTION_MODULES_DIRECTORY]: {
        'module-one.json': `{
          "name": "module-one",
          "code": "./separate-directory/module-code.js",
          "dependencies": [
            {
              "name": "lodash",
              "version": "4.17.21"
            }
          ],
          "secrets": []
        }`,
      },
    };
    createDir(repoDir, files);
    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actionModules).to.deep.equal(actionModulesTarget);
  });

  it('should ignore bad action modules directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'actionModules3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.ACTION_MODULES_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const context = new Context({ AUTH0_INPUT_FILE: repoDir }, mockMgmtClient());
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump action modules', async () => {
    const moduleName = 'module-one';
    const dir = path.join(testDataDir, 'directory', 'actionModules4');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const codeValidation = 'module.exports = { test: "test-value" };';

    context.assets.actionModules = [
      {
        name: moduleName,
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

    await handler.dump(context);

    const modulesFolder = path.join(dir, constants.ACTION_MODULES_DIRECTORY);

    expect(loadJSON(path.join(modulesFolder, 'module-one.json'))).to.deep.equal({
      name: moduleName,
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
    });
    expect(fs.readFileSync(path.join(modulesFolder, moduleName, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should dump action modules with identifiers when AUTH0_EXPORT_IDENTIFIERS is true', async () => {
    const moduleName = 'module-with-id';
    const dir = path.join(testDataDir, 'directory', 'actionModules5');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: dir, AUTH0_EXPORT_IDENTIFIERS: true },
      mockMgmtClient()
    );
    const codeValidation = 'module.exports = { test: "test-value" };';

    context.assets.actionModules = [
      {
        id: 'mod_123',
        name: moduleName,
        code: codeValidation,
        dependencies: [],
        secrets: [],
        actions_using_module_total: 0,
        all_changes_published: true,
        latest_version_number: 1,
      },
    ];

    await handler.dump(context);

    const modulesFolder = path.join(dir, constants.ACTION_MODULES_DIRECTORY);
    expect(loadJSON(path.join(modulesFolder, 'module-with-id.json'))).to.deep.equal({
      id: 'mod_123',
      name: moduleName,
      code: './action-modules/module-with-id/code.js',
      dependencies: [],
      secrets: [],
      actions_using_module_total: 0,
      all_changes_published: true,
      latest_version_number: 1,
    });
    expect(fs.readFileSync(path.join(modulesFolder, moduleName, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should process action modules with @@KEYWORD@@ format in secrets', async () => {
    const dir = path.join(testDataDir, 'directory', 'actionModules6');
    const modulesDir = path.join(dir, constants.ACTION_MODULES_DIRECTORY);
    cleanThenMkdir(modulesDir);

    const codeFile = path.join(modulesDir, 'code.js');
    fs.writeFileSync(codeFile, 'module.exports = {};');

    const json = `{
      "name": "module-with-secrets",
      "code": "./action-modules/code.js",
      "dependencies": [],
      "secrets": [
        {
          "name": "API_KEY",
          "value": "@@API_KEY_VALUE@@"
        },
        {
          "name": "DATABASE_URL",
          "value": "@@DB_CONNECTION@@"
        }
      ]
    }`;
    const jsonFile = path.join(modulesDir, 'module-with-secrets.json');
    fs.writeFileSync(jsonFile, json);

    const target = [
      {
        name: 'module-with-secrets',
        code: 'module.exports = {};',
        dependencies: [],
        secrets: [
          {
            name: 'API_KEY',
            value: 'secret-api-key-12345',
          },
          {
            name: 'DATABASE_URL',
            value: 'postgresql://localhost:5432/mydb',
          },
        ],
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: dir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        API_KEY_VALUE: 'secret-api-key-12345',
        DB_CONNECTION: 'postgresql://localhost:5432/mydb',
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actionModules).to.deep.equal(target);
  });

  it('should process action modules with ##KEYWORD## format in secrets', async () => {
    const dir = path.join(testDataDir, 'directory', 'actionModules7');
    const modulesDir = path.join(dir, constants.ACTION_MODULES_DIRECTORY);
    cleanThenMkdir(modulesDir);

    const codeFile = path.join(modulesDir, 'code.js');
    fs.writeFileSync(codeFile, 'module.exports = { env: "production" };');

    const json = `{
      "name": "env-module",
      "code": "./action-modules/code.js",
      "dependencies": [],
      "secrets": [
        {
          "name": "STRIPE_KEY",
          "value": "##STRIPE_SECRET_KEY##"
        },
        {
          "name": "SENDGRID_KEY",
          "value": "##SENDGRID_API_KEY##"
        }
      ]
    }`;
    const jsonFile = path.join(modulesDir, 'env-module.json');
    fs.writeFileSync(jsonFile, json);

    const target = [
      {
        name: 'env-module',
        code: 'module.exports = { env: "production" };',
        dependencies: [],
        secrets: [
          {
            name: 'STRIPE_KEY',
            value: 'sk_live_stripe_key_12345',
          },
          {
            name: 'SENDGRID_KEY',
            value: 'SG.sendgrid_api_key_67890',
          },
        ],
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: dir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        STRIPE_SECRET_KEY: 'sk_live_stripe_key_12345',
        SENDGRID_API_KEY: 'SG.sendgrid_api_key_67890',
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actionModules).to.deep.equal(target);
  });
});
