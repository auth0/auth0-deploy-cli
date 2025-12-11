import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';
import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/connectionProfiles';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context connectionProfiles', () => {
  it('should process connectionProfiles', async () => {
    const files = {
      [constants.CONNECTION_PROFILES_DIRECTORY]: {
        'someProfile.json': '{ "name": "someProfile", "enabled_features": ["scim"] }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'connectionProfiles1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      {
        name: 'someProfile',
        enabled_features: ['scim'],
      },
    ];
    expect(context.assets.connectionProfiles).to.deep.equal(target);
  });

  it('should dump connectionProfiles', async () => {
    const dir = path.join(testDataDir, 'directory', 'connectionProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.connectionProfiles = [{ name: 'someProfile', enabled_features: ['scim'] }];

    await handler.dump(context);
    const profileFolder = path.join(dir, constants.CONNECTION_PROFILES_DIRECTORY);

    expect(loadJSON(path.join(profileFolder, 'someProfile.json'))).to.deep.equal({
      name: 'someProfile',
      enabled_features: ['scim'],
    });
  });
});
