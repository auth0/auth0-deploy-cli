import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context YAML resource servers', () => {
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
          {
            description: 'update account',
            name: 'update:account'
          },
          {
            description: 'read account',
            name: 'read:account'
          },
          {
            description: 'admin access',
            name: 'admin'
          }
        ]
      }
    ];

    const yamlFile = writeStringToFile(path.join(dir, 'resources1.yaml'), yaml);
    const context = new Context(yamlFile, { name: 'my resource', identifier: 'http://myapi.com/api' }, null, mockMgmtClient());
    await context.load();

    expect(context.assets.resourceServers).to.deep.equal(target);
  });
});
