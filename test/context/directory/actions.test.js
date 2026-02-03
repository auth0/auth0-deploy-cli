import path from 'path';
import fs from 'fs-extra';

import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/actions';
import { getFiles, loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

const actionFiles = {
  [constants.ACTIONS_DIRECTORY]: {
    'code.js':
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log(@@replace@@); return {}; };',
    'action-one.json': `{
      "name": "action-one",
      "code": "./local/testData/directory/test1/actions/code.js",
      "runtime": "node12",
      "dependencies": [
        {
          "name": "lodash",
          "version": "4.17.20"
        }
      ],
      "secrets": [],
      "status": "built",
      "supported_triggers": [
        {
          "id": "post-login",
          "version": "v1"
        }
      ],
      "deployed": true
    }`,
  },
};

const actionFilesWin32 = {
  [constants.ACTIONS_DIRECTORY]: {
    'code.js':
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log(@@replace@@); return {}; };',
    'action-one.json': `{
      "name": "action-one",
      "code": "local\\\\testData\\\\directory\\\\test1\\\\actions\\\\code.js",
      "runtime": "node12",
      "dependencies": [
        {
          "name": "lodash",
          "version": "4.17.20"
        }
      ],
      "secrets": [],
      "status": "built",
      "supported_triggers": [
        {
          "id": "post-login",
          "version": "v1"
        }
      ],
      "deployed": true
    }`,
  },
};

const actionsTarget = [
  {
    name: 'action-one',
    code: '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };',
    runtime: 'node12',
    status: 'built',
    dependencies: [
      {
        name: 'lodash',
        version: '4.17.20',
      },
    ],
    secrets: [],
    supported_triggers: [
      {
        id: 'post-login',
        version: 'v1',
      },
    ],
    deployed: true,
  },
];

describe('#directory context actions', () => {
  it('should process actions from unix systems', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test1');
    createDir(repoDir, actionFiles);
    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { replace: 'test-action' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actions).to.deep.equal(actionsTarget);
  });

  it('should process actions from windows systems', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test1');
    createDir(repoDir, actionFilesWin32);
    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { replace: 'test-action' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actions).to.deep.equal(actionsTarget);
  });

  it('should process actions when code is stored in path relative to input file', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test5');
    const files = {
      'separate-directory': {
        'action-code.js':
          '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };',
      },
      [constants.ACTIONS_DIRECTORY]: {
        'action-one.json': `{
          "name": "action-one",
          "code": "./separate-directory/action-code.js",
          "runtime": "node12",
          "dependencies": [
            {
              "name": "lodash",
              "version": "4.17.20"
            }
          ],
          "secrets": [],
          "status": "built",
          "supported_triggers": [
            {
              "id": "post-login",
              "version": "v1"
            }
          ],
          "deployed": true
        }`,
      },
    };
    createDir(repoDir, files);
    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actions).to.deep.equal(actionsTarget);
  });

  it('should ignore bad actions directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test2');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.ACTIONS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const context = new Context({ AUTH0_INPUT_FILE: repoDir }, mockMgmtClient());
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump actions', async () => {
    const actionName = 'action-one';
    const dir = path.join(testDataDir, 'directory', 'test3');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const codeValidation =
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        name: actionName,
        code: codeValidation,
        runtime: 'node12',
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.20',
          },
        ],
        secrets: [],
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
        deployed: true,
        status: 'build',
      },
    ];

    await handler.dump(context);

    const actionsFolder = path.join(dir, constants.ACTIONS_DIRECTORY);

    expect(loadJSON(path.join(actionsFolder, 'action-one.json'))).to.deep.equal({
      name: actionName,
      code: './actions/action-one/code.js',
      runtime: 'node12',
      dependencies: [
        {
          name: 'lodash',
          version: '4.17.20',
        },
      ],
      secrets: [],
      supported_triggers: [
        {
          id: 'post-login',
          version: 'v1',
        },
      ],
      deployed: true,
      status: 'build',
    });
    expect(fs.readFileSync(path.join(actionsFolder, actionName, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should dump actions with identifiers when AUTH0_EXPORT_IDENTIFIERS is true', async () => {
    const actionName = 'action-with-id';
    const dir = path.join(testDataDir, 'directory', 'test3-with-id');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: dir, AUTH0_EXPORT_IDENTIFIERS: true },
      mockMgmtClient()
    );
    const codeValidation =
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        id: 'act_123',
        name: actionName,
        code: codeValidation,
        runtime: 'node12',
        dependencies: [],
        secrets: [],
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
        deployed: true,
        status: 'built',
      },
    ];

    await handler.dump(context);

    const actionsFolder = path.join(dir, constants.ACTIONS_DIRECTORY);
    expect(loadJSON(path.join(actionsFolder, 'action-with-id.json'))).to.deep.equal({
      id: 'act_123',
      name: actionName,
      code: './actions/action-with-id/code.js',
      runtime: 'node12',
      dependencies: [],
      secrets: [],
      supported_triggers: [
        {
          id: 'post-login',
          version: 'v1',
        },
      ],
      deployed: true,
      status: 'built',
    });
    expect(fs.readFileSync(path.join(actionsFolder, actionName, 'code.js'), 'utf8')).to.deep.equal(
      codeValidation
    );
  });

  it('should exclude marketplace actions during dump', async () => {
    const marketplaceAction = {
      id: 'D1AF7CCF-7ZAB-417F-81C0-533595A926D8',
      name: 'Travel0 Integration',
      supported_triggers: [
        {
          id: 'post-login',
          version: 'v1',
        },
      ],
      created_at: '2022-08-22T23:57:45.856907897Z',
      updated_at: '2022-08-22T23:57:45.856907897Z',
      installed_integration_id: '73f156dc-e7aa-47b4-9dda-0ef741205c31',
      integration: {
        id: '046042e2-5732-48ef-9313-0a93778ea8b1',
        catalog_id: 'travel0-action',
        url_slug: 'travel0-sms',
        partner_id: 'bea44019-d08d-47cd-b4f9-30074ca2ab69',
        name: 'Travel0',
        logo: 'https://cdn.auth0.com/travel0-logo.png',
        updated_at: '2022-05-03T15:05:45.684007768Z',
        created_at: '2021-08-24T20:49:30.446854653Z',
        feature_type: 'action',
        current_release: {
          id: '',
          semver: {},
        },
        all_changes_deployed: false,
      },
    };

    const dir = path.join(testDataDir, 'directory', 'test4');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.actions = [marketplaceAction];

    handler.dump(context);

    const dumpedFiles = getFiles(dir, ['.json']);

    expect(dumpedFiles).to.have.length(0);
  });

  it('should process actions secrets with AUTH0_PRESERVE_KEYWORDS: true', async () => {
    const dir = path.join(testDataDir, 'directory', 'test6');
    const actionsDir = path.join(dir, 'actions');
    cleanThenMkdir(actionsDir);

    const json = `{
      "name": "action-one",
      "secrets": "@@SECRETS@@"
    }`;
    const jsonFile = path.join(actionsDir, 'action-one.json');

    fs.writeFileSync(jsonFile, json);

    const target = [
      {
        name: 'action-one',
        secrets: { name: 'SECRETNAME', value: 'SECRETVALUE' },
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: dir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { SECRETS: { name: 'SECRETNAME', value: 'SECRETVALUE' } },
      AUTH0_PRESERVE_KEYWORDS: true,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.actions).to.deep.equal(target);
  });

  it('should dump actions with modules', async () => {
    const actionName = 'action-with-modules';
    const dir = path.join(testDataDir, 'directory', 'test-action-modules');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const codeValidation =
      '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        name: actionName,
        code: codeValidation,
        runtime: 'node12',
        dependencies: [],
        secrets: [],
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1',
          },
        ],
        deployed: true,
        status: 'built',
        modules: [
          {
            module_name: 'test-module',
            module_version_number: 1,
          },
        ],
      },
    ];

    await handler.dump(context);

    const actionsFolder = path.join(dir, constants.ACTIONS_DIRECTORY);

    expect(loadJSON(path.join(actionsFolder, 'action-with-modules.json'))).to.deep.equal({
      name: actionName,
      code: './actions/action-with-modules/code.js',
      runtime: 'node12',
      dependencies: [],
      secrets: [],
      supported_triggers: [
        {
          id: 'post-login',
          version: 'v1',
        },
      ],
      deployed: true,
      status: 'built',
      modules: [
        {
          module_name: 'test-module',
          module_version_number: 1,
        },
      ],
    });
    expect(
      fs.readFileSync(path.join(actionsFolder, actionName, 'code.js'), 'utf8')
    ).to.deep.equal(codeValidation);
  });
});
