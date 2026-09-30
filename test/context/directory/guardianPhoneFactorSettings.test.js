import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianPhoneFactorSettings';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian phone factor settings', () => {
  it('should process guardianPhoneFactorSettings', async () => {
    const guardianPhoneFactorSettingsTest = {
      'phoneFactorSettings.json': `{
        "otp_length": 6,
        "otp_expiration_time": 300
      }`,
    };
    const repoDir = path.join(testDataDir, 'directory', 'guardianPhoneFactorSettings');
    createDir(repoDir, { [constants.GUARDIAN_DIRECTORY]: guardianPhoneFactorSettingsTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.guardianPhoneFactorSettings).to.deep.equal({
      otp_length: 6,
      otp_expiration_time: 300,
    });
  });

  it('should dump guardian phone factor settings', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianPhoneFactorSettingsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianPhoneFactorSettings = {
      otp_length: 6,
      otp_expiration_time: 300,
    };

    await handler.dump(context);
    const guardianFolder = path.join(dir, constants.GUARDIAN_DIRECTORY);
    expect(loadJSON(path.join(guardianFolder, 'phoneFactorSettings.json'))).to.deep.equal({
      otp_length: 6,
      otp_expiration_time: 300,
    });
  });
});
