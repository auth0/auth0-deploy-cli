import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/guardianFactorTemplates';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context guardian factors templates provider', () => {
  it('should process guardian factor templates', async () => {
    const dir = path.join(testDataDir, 'yaml', 'guardianFactorTemplates');
    cleanThenMkdir(dir);

    const yaml = `
      guardianFactorTemplates:
        - name: sms
          enrollment_message: 'test message {{code}}'
          verification_message: '{{code}} is your verification code for {{tenant.friendly_name}}'
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        enrollment_message: 'test message {{code}}',
        name: 'sms',
        verification_message: '{{code}} is your verification code for {{tenant.friendly_name}}'
      }
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.guardianFactorTemplates).to.deep.equal(target);
  });

  it('should dump guardian factor teplates', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.guardianFactorTemplates = [
      {
        enrollment_message: 'test message {{code}}',
        name: 'sms',
        verification_message: '{{code}} is your verification code for {{tenant.friendly_name}}'
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      guardianFactorTemplates: [
        {
          enrollment_message: 'test message {{code}}',
          name: 'sms',
          verification_message: '{{code}} is your verification code for {{tenant.friendly_name}}'
        }
      ]
    });
  });
});
