import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/actions';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';


const actionFiles = {
  [constants.ACTIONS_DIRECTORY]: {
    'current_version.js': '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log(@@replace@@); return {}; };',
    'code.js': '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log(@@replace@@); return {}; };',
    'action-one.json': `{
      "name": "action-one",
      "code": "./local/testData/directory/test1/actions/code.js",
      "dependencies": [
        {
          "name": "lodash",
          "version": "4.17.20"
        }
      ],
      "secrets": [],
      "runtime": "node12",
      "status": "built",
      "supported_triggers": [
        {
          "id": "post-login",
          "version": "v1"
        }
      ],
      "current_version": {
        "status": "built",
        "code": "./local/testData/directory/test1/actions/current_version.js",
        "number": 1,
        "dependencies": [
          {
            "name": "lodash",
            "version": "4.17.20"
          }
        ],
        "secrets": [],
        "runtime": "node12"
      }
    }`
  }
};

const actionsTarget = [
  {
    name: 'action-one',
    code: '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };',
    status: 'built',
    dependencies: [
      {
        name: 'lodash',
        version: '4.17.20'
      }
    ],
    secrets: [],
    runtime: 'node12',
    supported_triggers: [
      {
        id: 'post-login',
        version: 'v1'
      }
    ],
    current_version: {
      status: 'built',
      number: 1,
      code: '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };',
      dependencies: [
        {
          name: 'lodash',
          version: '4.17.20'
        }
      ],
      secrets: [],
      runtime: 'node12'
    }
  }
];


describe('#directory context actions', () => {
  it('should process actions', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test1');
    createDir(repoDir, actionFiles);
    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { replace: 'test-action' } };
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
    const actionName =  'action-one'
    const dir = path.join(testDataDir, 'directory', 'test3');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const codeValidation = '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        name: actionName,
        code: codeValidation,
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.20'
          }
        ],
        secrets: [],
        runtime: 'node12',
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1'
          }
        ],
        current_version: {
          status: 'built',
          number: 1,
          code: codeValidation,
          dependencies: [
            {
              name: 'lodash',
              version: '4.17.20'
            }
          ],
          secrets: [],
          runtime: 'node12'
        }
      }
    ];

    await handler.dump(context);

    const actionsFolder = path.join(dir, constants.ACTIONS_DIRECTORY);

    expect(loadJSON(path.join(actionsFolder, 'action-one.json'))).to.deep.equal({
      name: actionName,
      code: path.join(context.filePath, '/actions/action-one/code.js'),
      dependencies: [
        {
          name: 'lodash',
          version: '4.17.20'
        }
      ],
      secrets: [],
      runtime: 'node12',
      supported_triggers: [
        {
          id: 'post-login',
          version: 'v1'
        }
      ],
      current_version: {
        code: path.join(context.filePath, '/actions/action-one/current_version.js'),
        status: 'built',
        number: 1,
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.20'
          }
        ],
        secrets: [],
        runtime: 'node12'
      }
    });
    expect(fs.readFileSync(path.join(actionsFolder,actionName, 'code.js'), 'utf8')).to.deep.equal(codeValidation);
    expect(fs.readFileSync(path.join(actionsFolder,actionName, 'current_version.js'), 'utf8')).to.deep.equal(codeValidation);
  });
});
