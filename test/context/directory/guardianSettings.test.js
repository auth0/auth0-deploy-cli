import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import handler from '../../../src/context/directory/handlers/guardianSettings';
import { loadJSON } from '../../../src/utils';

const SETTINGS = {
  display_remember_me_checkbox: true,
  remember_me_default_value: false,
  mfa_session_inactivity_timeout: 604800,
  mfa_session_overall_timeout: 2592000,
};

describe('#directory context guardian settings', () => {
  it('should process guardianSettings', async () => {
    const guardianSettingsTest = {
      'settings.json': JSON.stringify(SETTINGS),
    };
    const repoDir = path.join(testDataDir, 'directory', 'guardianSettings');
    createDir(repoDir, { [constants.GUARDIAN_DIRECTORY]: guardianSettingsTest });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.guardianSettings).to.deep.equal(SETTINGS);
  });

  it('should dump guardian settings', async () => {
    const dir = path.join(testDataDir, 'directory', 'guardianSettingsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.guardianSettings = { ...SETTINGS };

    await handler.dump(context);
    const guardianFolder = path.join(dir, constants.GUARDIAN_DIRECTORY);
    expect(loadJSON(path.join(guardianFolder, 'settings.json'))).to.deep.equal(SETTINGS);
  });
});
