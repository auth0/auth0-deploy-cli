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
    const codeFile = path.join(dir, 'action-one.js');
    fs.writeFileSync(codeFile, codeContext);

    const yaml = `
    actions:
      - name: action-one
        current_version:
          status: built
          code: "${codeFile}"
          dependencies:
            - name: lodash
              version: 4.17.20
          secrets: []
          runtime: node12
        bindings: []
        supported_triggers:
          - id: post-login
            version: v1
    `;
    const yamlFile = path.join(dir, 'action-one.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        name: 'action-one',
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
        },
        bindings: []
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

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      actions: [
        {
          name: 'action-one',
          supported_triggers: [
            {
              id: 'post-login',
              version: 'v1'
            }
          ],
          current_version: {
            code: './actions/action-one.js',
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
        }
      ]
    });

    const actionsFolder = path.join(dir, 'actions');
    expect(fs.readFileSync(path.join(actionsFolder, 'action-one.js'), 'utf8')).to.deep.equal(codeValidation);
  });
});
