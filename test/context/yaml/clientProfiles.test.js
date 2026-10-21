import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/clientProfiles';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context clientProfiles', () => {
  it('should process clientProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientProfiles');
    cleanThenMkdir(dir);

    const yaml = `
    clientProfiles:
      - name: "CIMD Profile"
        description: "##DESCRIPTION##"
        client_configuration:
          refresh_token:
            token_lifetime:
              default_value: 2592000
          organization_discovery_methods:
            default_value: @@DISCOVERY_METHODS@@
        apply_policy:
          external_metadata_type: cimd
          external_metadata_created_by: client
    `;
    const yamlFile = path.join(dir, 'tenant.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        DESCRIPTION: 'Policy for CIMD clients',
        DISCOVERY_METHODS: ['email'],
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clientProfiles).to.deep.equal([
      {
        name: 'CIMD Profile',
        description: 'Policy for CIMD clients',
        client_configuration: {
          refresh_token: { token_lifetime: { default_value: 2592000 } },
          organization_discovery_methods: { default_value: ['email'] },
        },
        apply_policy: {
          external_metadata_type: 'cimd',
          external_metadata_created_by: 'client',
        },
      },
    ]);
  });

  it('should dump clientProfiles without read-only fields', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.clientProfiles = [
      {
        id: 'cp_123',
        name: 'CIMD Profile',
        description: null,
        client_configuration: {},
        apply_policy: { external_metadata_type: 'cimd', external_metadata_created_by: 'client' },
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      clientProfiles: [
        {
          name: 'CIMD Profile',
          description: null,
          client_configuration: {},
          apply_policy: { external_metadata_type: 'cimd', external_metadata_created_by: 'client' },
        },
      ],
    });
  });

  it('should not dump clientProfiles when not set', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.clientProfiles = null;

    expect(await handler.dump(context)).to.deep.equal({ clientProfiles: null });
  });
});
