import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context email provider', () => {
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
    const yamlFile = writeStringToFile(path.join(dir, 'config.yaml'), yaml);

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

    const context = new Context(yamlFile, { ENV: 'test' }, null, mockMgmtClient());
    await context.load();
    expect(context.assets.emailProvider).to.deep.equal(target);
  });
});
