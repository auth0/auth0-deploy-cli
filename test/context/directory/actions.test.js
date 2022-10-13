import fs from 'fs-extra';

import path from 'path';
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
    await context.load();
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
    await context.load();
    expect(context.assets.actions).to.deep.equal(actionsTarget);
  });

  it('should ignore bad actions directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test2');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.ACTIONS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const context = new Context({ AUTH0_INPUT_FILE: repoDir });
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
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
      code: path.join(context.filePath, '/actions/action-one/code.js'),
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
});
