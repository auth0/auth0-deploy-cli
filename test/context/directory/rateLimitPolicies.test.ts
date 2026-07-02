import path from 'path';
import { expect } from 'chai';
import fs from 'fs-extra';
import { ManagementClient } from 'auth0';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/rateLimitPolicies';
import { constants } from '../../../src/tools';
import { cleanThenMkdir, mockMgmtClient, testDataDir } from '../../utils';
import { Config } from '../../../src/types';

describe('#directory context rateLimitPolicies', () => {
  it('should process rateLimitPolicies', async () => {
    const dir = path.join(testDataDir, 'directory', 'rateLimitPolicies-process');
    cleanThenMkdir(dir);
    const rateLimitPoliciesDir = path.join(dir, constants.RATE_LIMIT_POLICIES_DIRECTORY);
    cleanThenMkdir(rateLimitPoliciesDir);

    const policy1 = {
      resource: 'oauth_authentication_api',
      consumer: 'client',
      consumer_selector: 'all-clients',
      configuration: {
        action: 'block',
        limit: 100,
      },
    };

    const policy2 = {
      resource: 'oauth_authentication_api',
      consumer: 'client',
      consumer_selector: 'my-client-id',
      configuration: {
        action: 'allow',
      },
    };

    fs.writeFileSync(
      path.join(rateLimitPoliciesDir, 'all-clients.json'),
      JSON.stringify(policy1, null, 2)
    );
    fs.writeFileSync(
      path.join(rateLimitPoliciesDir, 'my-client.json'),
      JSON.stringify(policy2, null, 2)
    );

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.rateLimitPolicies).to.be.an('array');
    expect(context.assets.rateLimitPolicies).to.have.lengthOf(2);
    expect(context.assets.rateLimitPolicies).to.deep.include(policy1);
    expect(context.assets.rateLimitPolicies).to.deep.include(policy2);
  });

  it('should process empty rateLimitPolicies directory', async () => {
    const dir = path.join(testDataDir, 'directory', 'rateLimitPolicies-empty');
    cleanThenMkdir(dir);
    const rateLimitPoliciesDir = path.join(dir, constants.RATE_LIMIT_POLICIES_DIRECTORY);
    cleanThenMkdir(rateLimitPoliciesDir);

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.rateLimitPolicies).to.be.an('array');
    expect(context.assets.rateLimitPolicies).to.have.lengthOf(0);
  });

  it('should skip if rateLimitPolicies directory does not exist', async () => {
    const dir = path.join(testDataDir, 'directory', 'rateLimitPolicies-nonexistent');
    cleanThenMkdir(dir);

    const config = { AUTH0_INPUT_FILE: dir } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.rateLimitPolicies).to.equal(null);
  });

  it('should dump rateLimitPolicies', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rateLimitPolicies-dump');
    cleanThenMkdir(repoDir);
    const context = new Context(
      { AUTH0_INPUT_FILE: repoDir } as Config,
      mockMgmtClient() as unknown as ManagementClient
    );

    const rateLimitPolicies: any[] = [
      {
        id: 'rlp_123',
        resource: 'oauth_authentication_api',
        consumer: 'client',
        consumer_selector: 'all-clients',
        configuration: {
          action: 'block',
          limit: 100,
        },
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-02T00:00:00.000Z',
      },
      {
        id: 'rlp_456',
        resource: 'oauth_authentication_api',
        consumer: 'client',
        consumer_selector: 'my-client-id',
        configuration: {
          action: 'redirect',
          limit: 50,
          redirect_uri: 'https://example.com/blocked',
        },
        created_at: '2023-01-03T00:00:00.000Z',
        updated_at: '2023-01-04T00:00:00.000Z',
      },
    ];

    context.assets.rateLimitPolicies = rateLimitPolicies;

    await handler.dump(context);

    const rateLimitPoliciesDir = path.join(repoDir, constants.RATE_LIMIT_POLICIES_DIRECTORY);

    expect(fs.existsSync(rateLimitPoliciesDir)).to.equal(true);

    const allClientsFile = path.join(rateLimitPoliciesDir, 'all-clients.json');
    const myClientFile = path.join(rateLimitPoliciesDir, 'my-client-id.json');

    expect(fs.existsSync(allClientsFile)).to.equal(true);
    expect(fs.existsSync(myClientFile)).to.equal(true);

    const allClientsContent = JSON.parse(fs.readFileSync(allClientsFile, 'utf8'));
    const myClientContent = JSON.parse(fs.readFileSync(myClientFile, 'utf8'));

    // Verify id, created_at and updated_at were removed from both files
    expect(allClientsContent).to.not.have.property('id');
    expect(allClientsContent).to.not.have.property('created_at');
    expect(allClientsContent).to.not.have.property('updated_at');
    expect(myClientContent).to.not.have.property('id');
    expect(myClientContent).to.not.have.property('created_at');
    expect(myClientContent).to.not.have.property('updated_at');

    // Verify other properties were preserved
    expect(allClientsContent.resource).to.equal('oauth_authentication_api');
    expect(allClientsContent.consumer).to.equal('client');
    expect(allClientsContent.consumer_selector).to.equal('all-clients');
    expect(allClientsContent.configuration.action).to.equal('block');
    expect(allClientsContent.configuration.limit).to.equal(100);

    expect(myClientContent.resource).to.equal('oauth_authentication_api');
    expect(myClientContent.consumer).to.equal('client');
    expect(myClientContent.consumer_selector).to.equal('my-client-id');
    expect(myClientContent.configuration.action).to.equal('redirect');
    expect(myClientContent.configuration.limit).to.equal(50);
    expect(myClientContent.configuration.redirect_uri).to.equal('https://example.com/blocked');
  });

  it('should remove stale rate limit policy files when policies are removed from source', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'rateLimitPolicies-stale');
    cleanThenMkdir(repoDir);

    const rateLimitPoliciesDir = path.join(repoDir, constants.RATE_LIMIT_POLICIES_DIRECTORY);
    fs.ensureDirSync(rateLimitPoliciesDir);
    fs.writeFileSync(path.join(rateLimitPoliciesDir, 'old-client.json'), '{"consumer_selector":"old-client"}');
    fs.writeFileSync(path.join(rateLimitPoliciesDir, 'my-client-id.json'), '{"consumer_selector":"my-client-id"}');

    const context = new Context(
      { AUTH0_INPUT_FILE: repoDir } as Config,
      mockMgmtClient() as unknown as ManagementClient
    );
    // Re-export with only one policy (old-client removed)
    context.assets.rateLimitPolicies = [
      {
        id: 'rlp_456',
        resource: 'oauth_authentication_api',
        consumer: 'client',
        consumer_selector: 'my-client-id',
        configuration: { action: 'block', limit: 50 },
      },
    ] as any;

    await handler.dump(context);

    expect(fs.existsSync(path.join(rateLimitPoliciesDir, 'my-client-id.json'))).to.equal(true);
    expect(fs.existsSync(path.join(rateLimitPoliciesDir, 'old-client.json'))).to.equal(false);
  });
});
