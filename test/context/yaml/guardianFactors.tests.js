import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianFactors';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context guardian factors provider', () => {
  it('should process guardian factors', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianFactors');
    cleanThenMkdir(dir);

    const yaml = `
      guardianFactors:
        - name: sms
          enabled: true
        - name: push-notification
          enabled: false
        - name: otp
          enabled: false
        - name: email
          enabled: false
        - name: duo
          enabled: false
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      { enabled: true, name: 'sms' },
      { enabled: false, name: 'push-notification' },
      { enabled: false, name: 'otp' },
      { enabled: false, name: 'email' },
      { enabled: false, name: 'duo' }
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.guardianFactors).to.deep.equal(target);
  });

  it('should dump guardian factors', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianFactors = [
      { enabled: true, name: 'sms' },
      { enabled: false, name: 'push-notification' },
      { enabled: false, name: 'otp' },
      { enabled: false, name: 'email' },
      { enabled: false, name: 'duo' }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianFactors: [
        { enabled: true, name: 'sms' },
        { enabled: false, name: 'push-notification' },
        { enabled: false, name: 'otp' },
        { enabled: false, name: 'email' },
        { enabled: false, name: 'duo' }
      ]
    });
  });
});
