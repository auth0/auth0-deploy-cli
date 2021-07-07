import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/prompts';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context prompts settings', () => {
  it('should process prompts settings', async () => {
    const dir = path.join(testDataDir, 'yaml', 'prompts');
    cleanThenMkdir(dir);

    const yaml = `
    prompts:
      universal_login_experience: '##universal_login_experience##'
      identifier_first: true
      webauthn_platform_first_factor: false
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      universal_login_experience: 'new',
      identifier_first: true,
      webauthn_platform_first_factor: false
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { universal_login_experience: 'new' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.prompts).to.deep.equal(target);
  });

  it('should dump prompts', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const prompts = {
      universal_login_experience: 'classic',
      identifier_first: false
    };
    context.assets.prompts = prompts;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ prompts });
  });
});
