import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianSettings';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

const SETTINGS = {
  display_remember_me_checkbox: true,
  remember_me_default_value: false,
  mfa_session_inactivity_timeout: 604800,
  mfa_session_overall_timeout: 2592000,
};

describe('#YAML context guardian settings', () => {
  it('should process guardian settings', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianSettings');
    cleanThenMkdir(dir);

    const yaml = `
      guardianSettings:
        display_remember_me_checkbox: true
        remember_me_default_value: false
        mfa_session_inactivity_timeout: 604800
        mfa_session_overall_timeout: 2592000
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.guardianSettings).to.deep.equal(SETTINGS);
  });

  it('should dump guardian settings', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianSettings = { ...SETTINGS };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianSettings: SETTINGS,
    });
  });
});
