import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/resourceServers';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context resource servers', () => {
  it('should process resource servers', async () => {
    const dir = path.join(testDataDir, 'yaml', 'resourceServers1');
    cleanThenMkdir(dir);

    const yaml = `
    resourceServers:
      -
        name: "##name##"
        identifier: @@identifier@@
        scopes:
          - name: "update:account"
            description: "update account"
          - name: "read:account"
            description: "read account"
          - name: "admin"
            description: "admin access"
    `;

    const target = [
      {
        identifier: 'http://myapi.com/api',
        name: 'my resource',
        scopes: [
          { description: 'update account', name: 'update:account' },
          { description: 'read account', name: 'read:account' },
          { description: 'admin access', name: 'admin' },
        ],
      },
    ];

    const yamlFile = path.join(dir, 'resources1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { name: 'my resource', identifier: 'http://myapi.com/api' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.resourceServers).to.deep.equal(target);
  });

  it('should dump resource servers', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const resourceServers = [
      {
        identifier: 'http://myapi.com/api',
        name: 'my resource',
        scopes: [
          { description: 'update account', name: 'update:account' },
          { description: 'read account', name: 'read:account' },
          { description: 'admin access', name: 'admin' },
        ],
      },
    ];
    context.assets.resourceServers = resourceServers;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ resourceServers });
  });
});
