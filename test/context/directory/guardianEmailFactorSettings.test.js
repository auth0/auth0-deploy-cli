import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianEmailFactorSettings';
import { loadJSON } from '../../../src/utils';

describe('#directory context guardian email factor settings', () => {
  it('should process guardianEmailFactorSettings', async () => {
    const guardianEmailFactorSettingsTest = {
      'emailFactorSettings.json': `{
        "otp_length": 6,
        "otp_expiration_time": 300
      }`,
    };
    const repoDir = path.join(testDataDir, 'directory', 'guardianEmailFactorSettings');
    createDir(repoDir, { [constants.GUARDIAN_DIRECTORY]: guardianEmailFactorSettingsTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.guardianEmailFactorSettings).to.deep.equal({
      otp_length: 6,
      otp_expiration_time: 300,
    });
  });

  it('should dump guardian email factor settings', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianEmailFactorSettingsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianEmailFactorSettings = {
      otp_length: 6,
      otp_expiration_time: 300,
    };

    await handler.dump(context);
    const guardianFolder = path.join(dir, constants.GUARDIAN_DIRECTORY);
    expect(loadJSON(path.join(guardianFolder, 'emailFactorSettings.json'))).to.deep.equal({
      otp_length: 6,
      otp_expiration_time: 300,
    });
  });
});
