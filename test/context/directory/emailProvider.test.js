import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/emailProvider';
import { loadJSON } from '../../../src/utils';

describe('#directory context email provider', () => {
  it('should process emailProvider', async () => {
    const emailProviderTest = {
      'provider.json': `{
        "name": "smtp",
        "enabled": true
      }`

    }; const repoDir = path.join(testDataDir, 'directory', 'emailProvider');
    createDir(repoDir, { [constants.EMAIL_TEMPLATES_DIRECTORY]: emailProviderTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.emailProvider).to.deep.equal({
      enabled: true,
      name: 'smtp'
    });
  });

  it('should dump email provider', async () => {
    const dir = path.join(testDataDir, 'directory', 'emailProviderDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.emailProvider = {
      enabled: true,
      name: 'smtp'
    };

    await handler.dump(context);
    const emailTemplateFolder = path.join(dir, constants.EMAIL_TEMPLATES_DIRECTORY);
    expect(loadJSON(path.join(emailTemplateFolder, 'provider.json'))).to.deep.equal({
      credentials: {
        smtp_host: '##SMTP_HOSTNAME##',
        smtp_pass: '##SMTP_PASS##',
        smtp_port: '##SMTP_PORT##',
        smtp_user: '##SMTP_USER##'
      },
      enabled: true,
      name: 'smtp'
    });
  });

  it('should dump email provider without defaults when excluded', async () => {
    const dir = path.join(testDataDir, 'directory', 'emailProviderDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.exclude.defaults = [ 'emailProvider' ];
    context.assets.emailProvider = {
      enabled: true,
      name: 'smtp'
    };

    await handler.dump(context);
    const emailTemplateFolder = path.join(dir, constants.EMAIL_TEMPLATES_DIRECTORY);
    expect(loadJSON(path.join(emailTemplateFolder, 'provider.json'))).to.deep.equal({
      enabled: true,
      name: 'smtp'
    });
  });
});
