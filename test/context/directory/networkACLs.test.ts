import path from 'path';
import { expect } from 'chai';
import fs from 'fs-extra';
import { ManagementClient } from 'auth0/legacy';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/networkACLs';
import { constants } from '../../../src/tools';
import { cleanThenMkdir, mockMgmtClient, testDataDir } from '../../utils';
import { Config } from '../../../src/types';

describe('#directory context networkACLs', () => {
  it('should process networkACLs', async () => {
    const dir = path.join(testDataDir, 'directory', 'networkACLs-process');
    cleanThenMkdir(dir);
    const networkACLsDir = path.join(dir, constants.NETWORK_ACLS_DIRECTORY);
    cleanThenMkdir(networkACLsDir);

    const networkACL1 = {
      description: 'Block Anonymous Proxies',
      active: true,
      priority: 1,
      rule: {
        action: {
          block: true,
        },
        scope: 'tenant',
        match: {
          asns: [12345],
        },
      },
    };

    const networkACL2 = {
      description: 'Allow Specific Countries',
      active: true,
      priority: 2,
      rule: {
        action: {
          allow: true,
        },
        scope: 'authentication',
        match: {
          geo_country_codes: ['US', 'CA'],
        },
      },
    };

    fs.writeFileSync(
      path.join(networkACLsDir, 'block-anonymous-proxies.json'),
      JSON.stringify(networkACL1, null, 2)
    );
    fs.writeFileSync(
      path.join(networkACLsDir, 'allow-specific-countries.json'),
      JSON.stringify(networkACL2, null, 2)
    );

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.networkACLs).to.be.an('array');
    expect(context.assets.networkACLs).to.have.lengthOf(2);
    expect(context.assets.networkACLs).to.deep.include(networkACL1);
    expect(context.assets.networkACLs).to.deep.include(networkACL2);
  });

  it('should process empty networkACLs directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'networkACLs-empty');
    cleanThenMkdir(dir);
    const networkACLsDir = path.join(dir, constants.NETWORK_ACLS_DIRECTORY);
    cleanThenMkdir(networkACLsDir);

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.networkACLs).to.be.an('array');
    expect(context.assets.networkACLs).to.have.lengthOf(0);
  });

  it('should skip if networkACLs directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'networkACLs-nonexistent');
    cleanThenMkdir(dir);

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.networkACLs).to.equal(null);
  });

  it('should dump networkACLs', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'networkACLs-dump');
    cleanThenMkdir(repoDir);
    const context = new Context(
      { AUTH0_INPUT_FILE: repoDir } as Config,
      mockMgmtClient() as unknown as ManagementClient
    );

    const networkACLs: any[] = [
      {
        id: 'acl_123',
        description: 'Block Anonymous Proxies',
        active: true,
        priority: 1,
        rule: {
          action: {
            block: true,
          },
          scope: 'tenant',
          match: {
            asns: [12345],
          },
        },
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-02T00:00:00.000Z',
      },
      {
        id: 'acl_456',
        description: 'Redirect Specific User Agents',
        active: true,
        priority: 4,
        rule: {
          action: {
            redirect: true,
            redirect_uri: 'https://example.com/blocked',
          },
          scope: 'authentication',
          not_match: {
            user_agents: ['BadBot/1.0'],
          },
        },
        created_at: '2023-01-03T00:00:00.000Z',
        updated_at: '2023-01-04T00:00:00.000Z',
      },
    ];

    context.assets.networkACLs = networkACLs;

    await handler.dump(context);

    const networkACLsDir = path.join(repoDir, constants.NETWORK_ACLS_DIRECTORY);

    // Check that the files were created with sanitized names
    const blockAnonFile = path.join(networkACLsDir, 'Block Anonymous Proxies-p-1.json');
    const redirectUserAgentsFile = path.join(
      networkACLsDir,
      'Redirect Specific User Agents-p-4.json'
    );

    // Ensure the directory exists before checking files
    expect(fs.existsSync(networkACLsDir)).to.equal(true);

    expect(fs.existsSync(blockAnonFile)).to.equal(true);
    expect(fs.existsSync(redirectUserAgentsFile)).to.equal(true);

    // Check file contents
    const blockAnonContent = JSON.parse(fs.readFileSync(blockAnonFile, 'utf8'));
    const redirectUserAgentsContent = JSON.parse(fs.readFileSync(redirectUserAgentsFile, 'utf8'));

    // Verify created_at and updated_at were removed
    expect(blockAnonContent).to.not.have.property('created_at');
    expect(blockAnonContent).to.not.have.property('updated_at');
    expect(redirectUserAgentsContent).to.not.have.property('created_at');
    expect(redirectUserAgentsContent).to.not.have.property('updated_at');

    // Verify other properties were preserved
    expect(blockAnonContent.description).to.equal('Block Anonymous Proxies');
    expect(blockAnonContent.active).to.equal(true);
    expect(blockAnonContent.priority).to.equal(1);
    expect(blockAnonContent.rule.action.block).to.equal(true);
    expect(blockAnonContent.rule.scope).to.equal('tenant');
    expect(blockAnonContent.rule.match.asns).to.deep.equal([12345]);

    expect(redirectUserAgentsContent.description).to.equal('Redirect Specific User Agents');
    expect(redirectUserAgentsContent.active).to.equal(true);
    expect(redirectUserAgentsContent.priority).to.equal(4);
    expect(redirectUserAgentsContent.rule.action.redirect).to.equal(true);
    expect(redirectUserAgentsContent.rule.action.redirect_uri).to.equal(
      'https://example.com/blocked'
    );
    expect(redirectUserAgentsContent.rule.scope).to.equal('authentication');
    expect(redirectUserAgentsContent.rule.not_match.user_agents).to.deep.equal(['BadBot/1.0']);
  });
});
