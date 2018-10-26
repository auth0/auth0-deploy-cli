import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/emailProvider';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context email provider', () => {
  it('should process email provider', async () => {
    const dir = path.join(testDataDir, 'yaml', 'emailProvider');
    cleanThenMkdir(dir);

    const yaml = `
    emailProvider:
      name: "smtp"
      enabled: true
      credentials:
        smtp_host: "smtp.mailtrap.io"
        smtp_port: 2525
        smtp_user: "smtp_user"
        smtp_pass: "smtp_secret_password"
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = {
      credentials: {
        smtp_host: 'smtp.mailtrap.io',
        smtp_pass: 'smtp_secret_password',
        smtp_port: 2525,
        smtp_user: 'smtp_user'
      },
      enabled: true,
      name: 'smtp'
    };

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.emailProvider).to.deep.equal(target);
  });

  it('should dump email provider', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    context.assets.emailProvider = {
      enabled: true,
      name: 'smtp'
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      emailProvider: {
        credentials: {
          smtp_host: 'YOUR_SMTP_HOST',
          smtp_pass: 'YOUR_SMTP_PASS',
          smtp_port: 'YOUR_SMTP_PORT',
          smtp_user: 'YOUR_SMTP_USER'
        },
        enabled: true,
        name: 'smtp'
      }
    });
  });
});
