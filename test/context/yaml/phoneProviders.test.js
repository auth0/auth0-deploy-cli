import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/phoneProvider';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context phone providers', () => {
  it('should process phone providers', async () => {
    const dir = path.join(testDataDir, 'yaml', 'phoneProviders');
    cleanThenMkdir(dir);

    const yaml = `
phoneProviders:
  - name: twilio
    configuration:
      sid: ACc95b2e7e2426f6c6d795680e98c55ab7
      default_from: ++15673812247
      delivery_methods:
        - text
        - voice
    disabled: false
    credentials:
      auth_token: "some_auth_token"
`;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [{
      credentials: {
        auth_token : 'some_auth_token',
      },
      disabled: false,
      name: 'twilio',
      configuration:{
        sid: 'ACc95b2e7e2426f6c6d795680e98c55ab7',
        default_from: '++15673812247',
        delivery_methods: ['text', 'voice']
      }
    }];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.phoneProviders).to.deep.equal(target);
  });

  it('should dump phone providers', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.phoneProviders = [{
      disabled: false,
      name: 'twilio',
      configuration:{
        sid: 'ACc95b2e7e2426f6c6d795680e98c55ab7',
        default_from: '++15673812247',
        delivery_methods: ['text', 'voice']
      }
    }];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      phoneProviders: [{
        disabled: false,
        name: 'twilio',
        configuration:{
          sid: 'ACc95b2e7e2426f6c6d795680e98c55ab7',
          default_from: '++15673812247',
          delivery_methods: ['text', 'voice']
        }
      }],
    });
  });
});
