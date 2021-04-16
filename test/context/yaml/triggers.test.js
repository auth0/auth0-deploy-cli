import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/triggers';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context triggers', () => {
  it('should process triggers', async () => {
    const dir = path.join(testDataDir, 'yaml', 'test1');
    cleanThenMkdir(dir);


    const yaml = `
    triggers:
      credentials-exchange: []
      post-change-password: []
      post-login:
        - action_name: test-action
          display_name: display-name
      post-user-registration: []
      pre-user-registration: []
      send-phone-message: []
    `;
    const yamlFile = path.join(dir, 'triggers.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target =
      {
        'post-login': [
          {
            action_name: 'test-action',
            display_name: 'display-name'
          }
        ],
        'credentials-exchange': [],
        'pre-user-registration': [],
        'post-user-registration': [],
        'post-change-password': [],
        'send-phone-message': []
      };

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.triggers).to.deep.equal(target);
  });

  it('should dump triggers', async () => {
    const dir = path.join(testDataDir, 'yaml', 'actionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') }, mockMgmtClient());

    context.assets.triggers =
      {
        'post-login': [
          {
            action_name: 'test-action',
            display_name: 'display-name'
          }
        ],
        'credentials-exchange': [],
        'pre-user-registration': [],
        'post-user-registration': [],
        'post-change-password': [],
        'send-phone-message': []
      };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      triggers: {
        'post-login': [
          {
            action_name: 'test-action',
            display_name: 'display-name'
          }
        ],
        'credentials-exchange': [],
        'pre-user-registration': [],
        'post-user-registration': [],
        'post-change-password': [],
        'send-phone-message': []
      }
    });
  });
});
