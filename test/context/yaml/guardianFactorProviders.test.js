import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianFactorProviders';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context guardian factor provider provider', () => {
  it('should process guardian factor providers', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianFactorProviders');
    cleanThenMkdir(dir);

    const yaml = `
      guardianFactorProviders:
        - name: sms
          provider: twilio
          auth_token: @@ENV@@
          sid: test
          enabled: true
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        auth_token: 'test',
        enabled: true,
        name: 'sms',
        provider: 'twilio',
        sid: 'test',
      },
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.guardianFactorProviders).to.deep.equal(target);
  });

  it('should dump guardian factor providers', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianFactorProviders = [
      {
        auth_token: 'test',
        enabled: true,
        name: 'sms',
        provider: 'twilio',
        sid: 'test',
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianFactorProviders: [
        {
          auth_token: 'test',
          enabled: true,
          name: 'sms',
          provider: 'twilio',
          sid: 'test',
        },
      ],
    });
  });
});
