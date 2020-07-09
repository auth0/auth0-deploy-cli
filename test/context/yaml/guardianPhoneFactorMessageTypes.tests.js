import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianPhoneFactorMessageTypes';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context guardian phone factor message types provider', () => {
  it('should process guardian phone factor message types', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianPhoneFactorMessageTypes');
    cleanThenMkdir(dir);

    const yaml = `
      guardianPhoneFactorMessageTypes:
        message_types:
          - sms
          - voice
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      message_types: [ 'sms', 'voice' ]
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.guardianPhoneFactorMessageTypes).to.deep.equal(target);
  });

  it('should dump guardian phone factor message types', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianPhoneFactorMessageTypes = {
      message_types: [ 'sms', 'voice' ]
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianPhoneFactorMessageTypes: {
        message_types: [ 'sms', 'voice' ]
      }
    });
  });
});
