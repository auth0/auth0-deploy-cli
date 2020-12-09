import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/actions';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

const actions = {
  'action-one.js': '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log(@@replace@@); return {}; };',
  'action-one.json': `{
    "name": "action-one",
    "supported_triggers": [
      {
        "id": "post-login",
        "version": "v1"
      }
    ],
    "current_version": {
      "status": "built",
      "code": "./action-one.js",
      "number": 1,
      "dependencies": [
        {
          "name": "lodash",
          "version": "4.17.20"
        }
      ],
      "secrets": [],
      "runtime": "node12",
      "created_at": "2020-12-02T13:11:52.694151416Z",
      "updated_at": "2020-12-02T13:11:57.132608884Z"
    },
    "bindings": []
  }`
};

const actionsTarget = [
  {
    name: 'action-one',
    supported_triggers: [
      {
        id: 'post-login',
        version: 'v1'
      }
    ],
    current_version: {
      status: 'built',
      number: 1,
      created_at: '2020-12-02T13:11:52.694151416Z',
      updated_at: '2020-12-02T13:11:57.132608884Z',
      code: '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };',
      dependencies: [
        {
          name: 'lodash',
          version: '4.17.20'
        }
      ],
      secrets: [],
      runtime: 'node12'
    },
    bindings: []
  }
];


describe('#directory context actions', () => {
  it('should process actions', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'test1');
    const dir = path.join(repoDir);
    createDir(dir, { [constants.ACTIONS_DIRECTORY]: actions });

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
    const dir = path.join(testDataDir, 'yaml', 'test3');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const codeValidation = '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        name: 'action-one',
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1'
          }
        ],
        current_version: {
          status: 'built',
          number: 1,
          created_at: '2020-12-02T13:11:52.694151416Z',
          updated_at: '2020-12-02T13:11:57.132608884Z',
          code: codeValidation,
          dependencies: [
            {
              name: 'lodash',
              version: '4.17.20'
            }
          ],
          secrets: [],
          runtime: 'node12'
        },
        bindings: []
      }
    ];

    await handler.dump(context);

    const actionsFolder = path.join(dir, constants.ACTIONS_DIRECTORY);

    expect(loadJSON(path.join(actionsFolder, 'action-one.json'))).to.deep.equal({
      name: 'action-one',
      supported_triggers: [
        {
          id: 'post-login',
          version: 'v1'
        }
      ],
      current_version: {
        code: './action-one.js',
        status: 'built',
        number: 1,
        created_at: '2020-12-02T13:11:52.694151416Z',
        updated_at: '2020-12-02T13:11:57.132608884Z',
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.20'
          }
        ],
        secrets: [],
        runtime: 'node12'
      },
      bindings: []
    });
    expect(fs.readFileSync(path.join(actionsFolder, 'action-one.js'), 'utf8')).to.deep.equal(codeValidation);
  });
});
