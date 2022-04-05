import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianFactorProviders';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian factors providers provider', () => {
  it('should process guardianFactorProviders', async () => {
    const guardianFactorProvidersTest = {
      'sms-twilio.json': `{
        "name": "sms",
        "provider": "twilio",
        "auth_token": "test",
        "sid": "test",
        "messaging_service_sid": "test"
      }`,
    };

    const folder = path.join(constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_PROVIDERS_DIRECTORY);
    const repoDir = path.join(testDataDir, 'directory', 'guardianFactorProviders');
    createDir(repoDir, { [folder]: guardianFactorProvidersTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.guardianFactorProviders).to.deep.equal([
      {
        auth_token: 'test',
        messaging_service_sid: 'test',
        name: 'sms',
        provider: 'twilio',
        sid: 'test',
      },
    ]);
  });

  it('should dump guardian factor providers', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianFactorProvidersDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianFactorProviders = [
      {
        auth_token: 'test',
        messaging_service_sid: 'test',
        name: 'sms',
        provider: 'twilio',
        sid: 'test',
      },
    ];

    await handler.dump(context);
    const factorsProvidersFolder = path.join(
      dir,
      constants.GUARDIAN_DIRECTORY,
      constants.GUARDIAN_PROVIDERS_DIRECTORY
    );
    expect(loadJSON(path.join(factorsProvidersFolder, 'sms-twilio.json'))).to.deep.equal({
      auth_token: 'test',
      messaging_service_sid: 'test',
      name: 'sms',
      provider: 'twilio',
      sid: 'test',
    });
  });
});
