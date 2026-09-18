import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianPhoneFactorSettings';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context guardian phone factor settings', () => {
  it('should process guardian phone factor settings', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianPhoneFactorSettings');
    cleanThenMkdir(dir);

    const yaml = `
      guardianPhoneFactorSettings:
        otp_length: 6
        otp_expiration_time: 300
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      otp_length: 6,
      otp_expiration_time: 300,
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.guardianPhoneFactorSettings).to.deep.equal(target);
  });

  it('should dump guardian phone factor settings', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianPhoneFactorSettings = {
      otp_length: 6,
      otp_expiration_time: 300,
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianPhoneFactorSettings: {
        otp_length: 6,
        otp_expiration_time: 300,
      },
    });
  });
});
