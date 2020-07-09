import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianPhoneFactorSelectedProvider';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian phone factor selected provider', () => {
  it('should process guardianPhoneFactorSelectedProvider', async () => {
    const guardianPhoneFactorSelectedProviderTest = {
      'phoneFactorSelectedProvider.json': `{
        "provider": "twilio"
      }`
    };
    const repoDir = path.join(testDataDir, 'directory', 'guardianPhoneFactorSelectedProvider');
    createDir(repoDir, { [constants.GUARDIAN_DIRECTORY]: guardianPhoneFactorSelectedProviderTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.guardianPhoneFactorSelectedProvider).to.deep.equal({
      provider: 'twilio'
    });
  });

  it('should dump guardian phone factor selected provider', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianPhoneFactorSelectedProviderDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianPhoneFactorSelectedProvider = {
      provider: 'twilio'
    };

    await handler.dump(context);
    const guardianFolder = path.join(dir, constants.GUARDIAN_DIRECTORY);
    expect(loadJSON(path.join(guardianFolder, 'phoneFactorSelectedProvider.json'))).to.deep.equal({
      provider: 'twilio'
    });
  });
});
