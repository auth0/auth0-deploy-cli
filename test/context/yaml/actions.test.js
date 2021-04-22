import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/actions';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context actions', () => {
  it('should process actions', async () => {
    const dir = path.join(testDataDir, 'yaml', 'action-one');
    cleanThenMkdir(dir);

    const codeContext = '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log(@@replace@@); return {}; };';
    const currentVersionFile = path.join(dir, 'current_version.js');
    fs.writeFileSync(currentVersionFile, codeContext);

    const codeFile = path.join(dir, 'code.js');
    fs.writeFileSync(codeFile, codeContext);


    const yaml = `
    actions:
      - name: action-one
        code: "${currentVersionFile}"
        runtime: node12
        status: built
        current_version:
          status: built
          code: "${currentVersionFile}"
          dependencies:
            - name: lodash
              version: 4.17.20
          secrets: []
          runtime: node12
        supported_triggers:
          - id: post-login
            version: v1
    `;
    const yamlFile = path.join(dir, 'action-one.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        name: 'action-one',
        code: '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };',
        runtime: 'node12',
        status: 'built',
        supported_triggers: [
          {
            id: 'post-login',
            version: 'v1'
          }
        ],
        current_version: {
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

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { replace: 'test-action' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.actions).to.deep.equal(target);
  });

  it('should dump actions', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') }, mockMgmtClient());
    const codeValidation = '/** @type {PostLoginAction} */ module.exports = async (event, context) => { console.log("test-action"); return {}; };';

    context.assets.actions = [
      {
        name: 'action-one',
        code: codeValidation,
        status: 'built',
        runtime: 'node12',
        dependencies: [
          {
            name: 'lodash',
            version: '4.17.20'
          }
        ],
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

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      actions: [
        {
          name: 'action-one',
          code: './actions/action-one/code.js',
          status: 'built',
          runtime: 'node12',
          secrets: [],
          dependencies: [
            {
              name: 'lodash',
              version: '4.17.20'
            }
          ],
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1'
            }
          ],
          current_version: {
            code: './actions/action-one/current_version.js',
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
        }
      ]
    });

    const actionsFolder = path.join(dir, 'actions', 'action-one');
    expect(fs.readFileSync(path.join(actionsFolder, 'current_version.js'), 'utf8')).to.deep.equal(codeValidation);
    expect(fs.readFileSync(path.join(actionsFolder, 'code.js'), 'utf8')).to.deep.equal(codeValidation);
  });
});
