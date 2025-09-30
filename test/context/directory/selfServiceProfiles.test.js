import path from 'path';

import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/selfServiceProfiles';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context selfServiceProfiles', () => {
  it('should process selfServiceProfiles', async () => {
    const files = {
      [constants.SELF_SERVICE_PROFILE_DIRECTORY]: {
        'test-self-service-profile.json':
          '{ "name": "test-self-service-profile", "description": "test Self-Service Profile" }',
        'test-self-service-profile-2.json':
          '{ "name": "test-self-service-profile-2", "description": "test self-Service new profile 2" }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'selfServiceProfiles');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      { name: 'test-self-service-profile-2', description: 'test self-Service new profile 2' },
      { name: 'test-self-service-profile', description: 'test Self-Service Profile' },
    ];
    expect(context.assets.selfServiceProfiles).to.deep.equal(target);
  });

  it('should dump selfServiceProfiles', async () => {
    const dir = path.join(testDataDir, 'directory', 'selfServiceProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.selfServiceProfiles = [
      { name: 'test-self-service-profile-2', description: 'test self-Service new profile 2' },
      { name: 'test-self-service-profile', description: 'test Self-Service Profile' },
    ];

    await handler.dump(context);
    const selfServiceProfilesFolder = path.join(dir, constants.SELF_SERVICE_PROFILE_DIRECTORY);
    expect(
      loadJSON(path.join(selfServiceProfilesFolder, 'test-self-service-profile-2.json'))
    ).to.deep.equal(context.assets.selfServiceProfiles[0]);
    expect(
      loadJSON(path.join(selfServiceProfilesFolder, 'test-self-service-profile.json'))
    ).to.deep.equal(context.assets.selfServiceProfiles[1]);
  });

  it('should swap user_attribute_profile_id IDs to names on dump', async () => {
    const dir = path.join(testDataDir, 'directory', 'selfServiceProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.selfServiceProfiles = [
      { name: 'test-self-service-profile-2', description: 'test self-Service new profile 2', user_attribute_profile_id: 'uap_12345' },
      { name: 'test-self-service-profile', description: 'test Self-Service Profile', user_attribute_profile_id: 'uap_67890' },
    ];
    context.assets.userAttributeProfilesWithId = [
      { id: 'uap_12345', name: 'profile1' },
      { id: 'uap_67890', name: 'profile2' },
    ];

    await handler.dump(context);
    const selfServiceProfilesFolder = path.join(dir, constants.SELF_SERVICE_PROFILE_DIRECTORY);

    const expected = [
      { name: 'test-self-service-profile-2', description: 'test self-Service new profile 2', user_attribute_profile_id: 'profile1' },
      { name: 'test-self-service-profile', description: 'test Self-Service Profile', user_attribute_profile_id: 'profile2' },
    ];

    expect(
      loadJSON(path.join(selfServiceProfilesFolder, 'test-self-service-profile-2.json'))
    ).to.deep.equal(expected[0]);
    expect(
      loadJSON(path.join(selfServiceProfilesFolder, 'test-self-service-profile.json'))
    ).to.deep.equal(expected[1]);
  });

  it('should dump selfServiceProfiles sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'selfServiceProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.selfServiceProfiles = [
      { name: 'test-self-service-profile-2', description: 'test self-Service new profile 2' },
      { name: 'test-self-service-profile', description: 'test Self-Service Profile' },
    ];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.SELF_SERVICE_PROFILE_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'test-self-service-profile-2.json'))).to.deep.equal(
      context.assets.selfServiceProfiles[0]
    );
    expect(loadJSON(path.join(clientFolder, 'test-self-service-profile.json'))).to.deep.equal(
      context.assets.selfServiceProfiles[1]
    );
  });
});
