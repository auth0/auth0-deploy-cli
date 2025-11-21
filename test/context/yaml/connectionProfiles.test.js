import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/connectionProfiles';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context connectionProfiles', () => {
  it('should process connectionProfiles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'connectionProfiles');
    cleanThenMkdir(dir);

    const yaml = `
    connectionProfiles:
      - name: "someProfile"
        enabled_features:
          - scim
    `;
    const yamlFile = path.join(dir, 'tenant.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
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
    const context = new Context({ AUTH0_INPUT_FILE: './test.yaml' }, mockMgmtClient());
    context.assets.connectionProfiles = [
      { name: 'someProfile', enabled_features: ['scim'], id: 'cp_123' },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      connectionProfiles: [{ name: 'someProfile', enabled_features: ['scim'] }],
    });
  });
});
