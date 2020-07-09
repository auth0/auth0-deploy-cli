import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianPhoneFactorSelectedProvider';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context guardian phone factor selected provider', () => {
  it('should process guardian phone factor selected provider', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianPhoneFactorSelectedProvider');
    cleanThenMkdir(dir);

    const yaml = `
      guardianPhoneFactorSelectedProvider:
        provider: twilio
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      provider: 'twilio'
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.guardianPhoneFactorSelectedProvider).to.deep.equal(target);
  });

  it('should dump guardian phone factor selected provider', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianPhoneFactorSelectedProvider = {
      provider: 'twilio'
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianPhoneFactorSelectedProvider: {
        provider: 'twilio'
      }
    });
  });
});
