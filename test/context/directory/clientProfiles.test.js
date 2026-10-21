import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { constants } from '../../../src/tools';
import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/clientProfiles';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context clientProfiles', () => {
  it('should process clientProfiles', async () => {
    const files = {
      [constants.CLIENT_PROFILES_DIRECTORY]: {
        'CIMD Profile.json': `{
          "name": "CIMD Profile",
          "description": "##DESCRIPTION##",
          "client_configuration": {
            "require_proof_of_possession": { "default_value": true },
            "organization_discovery_methods": { "default_value": @@DISCOVERY_METHODS@@ }
          },
          "apply_policy": {
            "external_metadata_type": "cimd",
            "external_metadata_created_by": "client"
          }
        }`,
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clientProfiles1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        DESCRIPTION: 'Policy for CIMD clients',
        DISCOVERY_METHODS: ['email', 'organization_name'],
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clientProfiles).to.deep.equal([
      {
        name: 'CIMD Profile',
        description: 'Policy for CIMD clients',
        client_configuration: {
          require_proof_of_possession: { default_value: true },
          organization_discovery_methods: { default_value: ['email', 'organization_name'] },
        },
        apply_policy: {
          external_metadata_type: 'cimd',
          external_metadata_created_by: 'client',
        },
      },
    ]);
  });

  it('should skip when the folder does not exist', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'clientProfilesEmpty');
    cleanThenMkdir(repoDir);

    const context = new Context({ AUTH0_INPUT_FILE: repoDir }, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clientProfiles).to.equal(null);
  });

  it('should dump clientProfiles without read-only fields', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientProfilesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clientProfiles = [
      {
        id: 'cp_123',
        name: 'CIMD Profile',
        client_configuration: { require_proof_of_possession: { default_value: true } },
        apply_policy: { external_metadata_type: 'cimd', external_metadata_created_by: 'client' },
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      },
    ];

    await handler.dump(context);
    const profileFolder = path.join(dir, constants.CLIENT_PROFILES_DIRECTORY);

    expect(fs.readdirSync(profileFolder)).to.deep.equal(['CIMD Profile.json']);
    expect(loadJSON(path.join(profileFolder, 'CIMD Profile.json'))).to.deep.equal({
      name: 'CIMD Profile',
      client_configuration: { require_proof_of_possession: { default_value: true } },
      apply_policy: { external_metadata_type: 'cimd', external_metadata_created_by: 'client' },
    });
  });
});
