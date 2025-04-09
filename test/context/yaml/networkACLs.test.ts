import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import { ManagementClient } from 'auth0';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/networkACLs';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';
import { Config } from '../../../src/types';

describe('#YAML context networkACLs', () => {
  it('should process networkACLs', async () => {
    const dir = path.join(testDataDir, 'yaml', 'networkACLs');
    cleanThenMkdir(dir);

    const yaml = `
    networkACLs:
      -
        description: 'Block Anonymous Proxies'
        active: true
        priority: 1
        rule:
          action:
            block: true
          scope: 'tenant'
          match:
            anonymous_proxy: true
      -
        description: 'Allow Specific Countries'
        active: true
        priority: 2
        rule:
          action:
            allow: true
          scope: 'authentication'
          match:
            geo_country_codes:
              - 'US'
              - 'CA'
      -
        description: 'Log Specific IP Range'
        active: false
        priority: 3
        rule:
          action:
            log: true
          scope: 'management'
          match:
            ipv4_cidrs:
              - '192.168.1.0/24'
    `;

    const target = [
      {
        description: 'Block Anonymous Proxies',
        active: true,
        priority: 1,
        rule: {
          action: {
            block: true,
          },
          scope: 'tenant',
          match: {
            anonymous_proxy: true,
          },
        },
      },
      {
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
      },
      {
        description: 'Log Specific IP Range',
        active: false,
        priority: 3,
        rule: {
          action: {
            log: true,
          },
          scope: 'management',
          match: {
            ipv4_cidrs: ['192.168.1.0/24'],
          },
        },
      },
    ];

    const yamlFile = path.join(dir, 'networkACLs.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();
    expect(context.assets.networkACLs).to.deep.equal(target);
  });

  it('should dump networkACLs', async () => {
    const dir = path.join(testDataDir, 'yaml', 'networkACLs');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './networkACLs.yml') } as Config,
      mockMgmtClient() as unknown as ManagementClient
    );

    // Using any type to avoid TypeScript errors with the test data
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
            anonymous_proxy: true,
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
          match: {
            user_agents: ['BadBot/1.0'],
          },
        },
        created_at: '2023-01-03T00:00:00.000Z',
        updated_at: '2023-01-04T00:00:00.000Z',
      },
    ];

    context.assets.networkACLs = cloneDeep(networkACLs);

    const dumped = await handler.dump(context);

    // Create a copy without the fields that should be stripped during dump
    const expectedNetworkACLs = cloneDeep(networkACLs).map((acl) => {
      const { created_at: createdAt, updated_at: updatedAt, ...rest } = acl;
      return rest;
    });

    expect(dumped).to.deep.equal({ networkACLs: expectedNetworkACLs });
  });
});
