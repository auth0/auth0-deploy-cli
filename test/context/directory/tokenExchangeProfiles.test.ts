import path from 'path';
import { expect } from 'chai';
import fs from 'fs-extra';
import { ManagementClient } from 'auth0';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/tokenExchangeProfiles';
import { constants } from '../../../src/tools';
import { cleanThenMkdir, mockMgmtClient, testDataDir } from '../../utils';
import { Config } from '../../../src/types';

describe('#directory context tokenExchangeProfiles', () => {
  it('should process tokenExchangeProfiles', async () => {
    const dir = path.join(testDataDir, 'directory', 'tokenExchangeProfiles-process');
    cleanThenMkdir(dir);
    const tokenExchangeProfilesDir = path.join(dir, constants.TOKEN_EXCHANGE_PROFILES_DIRECTORY);
    cleanThenMkdir(tokenExchangeProfilesDir);

    const profile1 = {
      name: 'CIS token exchange',
      subject_token_type: 'https://acme.com/cis-token',
      action: 'my-action',
      type: 'custom_authentication',
    };

    const profile2 = {
      name: 'Partner token exchange',
      subject_token_type: 'https://partner.com/auth-token',
      action: 'partner-action',
      type: 'custom_authentication',
    };

    fs.writeFileSync(
      path.join(tokenExchangeProfilesDir, 'CIS token exchange.json'),
      JSON.stringify(profile1, null, 2)
    );
    fs.writeFileSync(
      path.join(tokenExchangeProfilesDir, 'Partner token exchange.json'),
      JSON.stringify(profile2, null, 2)
    );

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.tokenExchangeProfiles).to.be.an('array');
    expect(context.assets.tokenExchangeProfiles).to.have.lengthOf(2);
    expect(context.assets.tokenExchangeProfiles).to.deep.include(profile1);
    expect(context.assets.tokenExchangeProfiles).to.deep.include(profile2);
  });

  it('should process empty tokenExchangeProfiles directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'tokenExchangeProfiles-empty');
    cleanThenMkdir(dir);
    const tokenExchangeProfilesDir = path.join(dir, constants.TOKEN_EXCHANGE_PROFILES_DIRECTORY);
    cleanThenMkdir(tokenExchangeProfilesDir);

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.tokenExchangeProfiles).to.be.an('array');
    expect(context.assets.tokenExchangeProfiles).to.have.lengthOf(0);
  });

  it('should skip if tokenExchangeProfiles directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'tokenExchangeProfiles-nonexistent');
    cleanThenMkdir(dir);

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.tokenExchangeProfiles).to.equal(null);
  });

  it('should dump tokenExchangeProfiles', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'tokenExchangeProfiles-dump');
    cleanThenMkdir(repoDir);
    const context = new Context(
      { AUTH0_INPUT_FILE: repoDir } as Config,
      mockMgmtClient() as unknown as ManagementClient
    );

    const tokenExchangeProfiles: any[] = [
      {
        id: 'tep_123',
        name: 'CIS token exchange',
        subject_token_type: 'https://acme.com/cis-token',
        action: 'my-action',
        type: 'custom_authentication',
        created_at: '2024-10-01T16:09:42.725Z',
        updated_at: '2024-10-01T16:09:42.725Z',
      },
      {
        id: 'tep_456',
        name: 'Partner token exchange',
        subject_token_type: 'https://partner.com/auth-token',
        action: 'partner-action',
        type: 'custom_authentication',
        created_at: '2024-10-02T10:15:30.123Z',
        updated_at: '2024-10-02T10:15:30.123Z',
      },
    ];

    context.assets.tokenExchangeProfiles = tokenExchangeProfiles;

    handler.dump(context);

    const tokenExchangeProfilesDir = path.join(
      repoDir,
      constants.TOKEN_EXCHANGE_PROFILES_DIRECTORY
    );

    // Check that the files were created with sanitized names
    const cisFile = path.join(tokenExchangeProfilesDir, 'CIS token exchange.json');
    const partnerFile = path.join(tokenExchangeProfilesDir, 'Partner token exchange.json');

    // Ensure the directory exists before checking files
    expect(fs.existsSync(tokenExchangeProfilesDir)).to.equal(true);

    expect(fs.existsSync(cisFile)).to.equal(true);
    expect(fs.existsSync(partnerFile)).to.equal(true);

    // Check file contents
    const cisContent = JSON.parse(fs.readFileSync(cisFile, 'utf8'));
    const partnerContent = JSON.parse(fs.readFileSync(partnerFile, 'utf8'));

    // Verify id, created_at and updated_at were removed
    expect(cisContent).to.not.have.property('id');
    expect(cisContent).to.not.have.property('created_at');
    expect(cisContent).to.not.have.property('updated_at');
    expect(partnerContent).to.not.have.property('id');
    expect(partnerContent).to.not.have.property('created_at');
    expect(partnerContent).to.not.have.property('updated_at');

    // Verify other properties were preserved
    expect(cisContent.name).to.equal('CIS token exchange');
    expect(cisContent.subject_token_type).to.equal('https://acme.com/cis-token');
    expect(cisContent.action).to.equal('my-action');
    expect(cisContent.type).to.equal('custom_authentication');

    expect(partnerContent.name).to.equal('Partner token exchange');
    expect(partnerContent.subject_token_type).to.equal('https://partner.com/auth-token');
    expect(partnerContent.action).to.equal('partner-action');
    expect(partnerContent.type).to.equal('custom_authentication');
  });
});
