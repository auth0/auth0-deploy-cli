import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import { ManagementClient } from 'auth0';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/tokenExchangeProfiles';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';
import { Config } from '../../../src/types';

describe('#YAML context tokenExchangeProfiles', () => {
  it('should process tokenExchangeProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'tokenExchangeProfiles');
    cleanThenMkdir(dir);

    const yaml = `
    tokenExchangeProfiles:
      -
        name: 'CIS token exchange'
        subject_token_type: 'https://acme.com/cis-token'
        action: 'my-action'
        type: 'custom_authentication'
      -
        name: 'Partner token exchange'
        subject_token_type: 'https://partner.com/auth-token'
        action: 'partner-action'
        type: 'custom_authentication'
      -
        name: 'External token exchange'
        subject_token_type: 'https://external.com/token'
        action: 'external-action'
        type: 'custom_authentication'
    `;

    const target = [
      {
        name: 'CIS token exchange',
        subject_token_type: 'https://acme.com/cis-token',
        action: 'my-action',
        type: 'custom_authentication',
      },
      {
        name: 'Partner token exchange',
        subject_token_type: 'https://partner.com/auth-token',
        action: 'partner-action',
        type: 'custom_authentication',
      },
      {
        name: 'External token exchange',
        subject_token_type: 'https://external.com/token',
        action: 'external-action',
        type: 'custom_authentication',
      },
    ];

    const yamlFile = path.join(dir, 'tokenExchangeProfiles.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();
    expect(context.assets.tokenExchangeProfiles).to.deep.equal(target);
  });

  it('should return null when tokenExchangeProfiles is not in YAML', async () => {
    const dir = path.join(testDataDir, 'yaml', 'tokenExchangeProfiles-no-section');
    cleanThenMkdir(dir);

    const yaml = `
    clients:
      - name: 'Test Client'
    `;

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile } as Config;
    const context = new Context(config, mockMgmtClient() as unknown as ManagementClient);
    await context.loadAssetsFromLocal();

    expect(context.assets.tokenExchangeProfiles).to.equal(null);
  });

  it('should dump tokenExchangeProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'tokenExchangeProfiles');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './tokenExchangeProfiles.yml') } as Config,
      mockMgmtClient() as unknown as ManagementClient
    );

    // Using any type to avoid TypeScript errors with the test data
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

    context.assets.tokenExchangeProfiles = cloneDeep(tokenExchangeProfiles);

    const dumped = await handler.dump(context);

    // Create a copy without the fields that should be stripped during dump
    const expectedTokenExchangeProfiles = cloneDeep(tokenExchangeProfiles).map((profile) => {
      const { id, created_at: createdAt, updated_at: updatedAt, ...rest } = profile;
      return rest;
    });

    expect(dumped).to.deep.equal({ tokenExchangeProfiles: expectedTokenExchangeProfiles });
  });

  it('should handle null tokenExchangeProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'tokenExchangeProfiles-null');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './tokenExchangeProfiles.yml') } as Config,
      mockMgmtClient() as unknown as ManagementClient
    );

    context.assets.tokenExchangeProfiles = null as any;

    const dumped = await handler.dump(context);

    expect(dumped).to.deep.equal({ tokenExchangeProfiles: null });
  });
});
