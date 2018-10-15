import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/emailProvider';
import { loadJSON } from '../../../src/utils';

const emailProviderTest = {
  'provider.json': `{
    "name": "smtp",
    "enabled": true,
    "credentials": {
      "smtp_host": "##env##.smtpserver.com",
      "smtp_port": 2525,
      "smtp_user": "smtp_user",
      "smtp_pass": "smtp_secret_password"
    }
  }`
};

const emailProviderTarget = {
  credentials: {
    smtp_host: 'test.smtpserver.com', smtp_pass: 'smtp_secret_password', smtp_port: 2525, smtp_user: 'smtp_user'
  },
  enabled: true,
  name: 'smtp'
};

describe('#directory context email provider', () => {
  it('should process emailProvider', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'emailProvider');
    createDir(repoDir, { [constants.EMAIL_TEMPLATES_DIRECTORY]: emailProviderTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.emailProvider).to.deep.equal(emailProviderTarget);
  });

  it('should dump email provider', async () => {
    const dir = path.join(testDataDir, 'directory', 'emailProviderDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.emailProvider = {
      credentials: {
        smtp_host: 'smtp.mailtrap.io',
        smtp_pass: 'smtp_secret_password',
        smtp_port: 2525,
        smtp_user: 'smtp_user'
      },
      enabled: true,
      name: 'smtp'
    };

    await handler.dump(context);
    const emailTemplateFolder = path.join(dir, constants.EMAIL_TEMPLATES_DIRECTORY);
    expect(loadJSON(path.join(emailTemplateFolder, 'provider.json'))).to.deep.equal(context.assets.emailProvider);
  });
});
