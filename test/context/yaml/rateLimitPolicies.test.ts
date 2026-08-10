import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import { ManagementClient } from 'auth0';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/rateLimitPolicies';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';
import { Config } from '../../../src/types';

describe('#YAML context rateLimitPolicies', () => {
  it('should process rateLimitPolicies', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rateLimitPolicies');
    cleanThenMkdir(dir);

    const yaml = `
    rateLimitPolicies:
      -
        resource: 'oauth_authentication_api'
        consumer: 'client'
        consumer_selector: 'all-clients'
        configuration:
          action: 'block'
          limit: 100
      -
        resource: 'oauth_authentication_api'
        consumer: 'client'
        consumer_selector: 'my-client-id'
        configuration:
          action: 'allow'
    `;

    const target = [
      {
        resource: 'oauth_authentication_api',
        consumer: 'client',
        consumer_selector: 'all-clients',
        configuration: {
          action: 'block',
          limit: 100,
        },
      },
      {
        resource: 'oauth_authentication_api',
        consumer: 'client',
        consumer_selector: 'my-client-id',
        configuration: {
          action: 'allow',
        },
      },
    ];

    const yamlFile = path.join(dir, 'rateLimitPolicies.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();
    expect(context.assets.rateLimitPolicies).to.deep.equal(target);
  });

  it('should dump rateLimitPolicies', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rateLimitPolicies');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './rateLimitPolicies.yml') } as Config,
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

    context.assets.rateLimitPolicies = cloneDeep(rateLimitPolicies);

    const dumped = await handler.dump(context);

    // Create a copy without the fields that should be stripped during dump
    const expectedRateLimitPolicies = cloneDeep(rateLimitPolicies).map((policy) => {
      const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...rest } = policy;
      return rest;
    });

    expect(dumped).to.deep.equal({ rateLimitPolicies: expectedRateLimitPolicies });
  });
});
