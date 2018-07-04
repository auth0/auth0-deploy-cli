import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/yaml';
import { writeStringToFile, testDataDir, cleanThenMkdir } from 'test/utils';


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

    const target = {
      'my resource': {
        configFile: '{"name":"my resource","identifier":"http://myapi.com/api","scopes":[{"value":"update:account","description":"update account"},{"value":"read:account","description":"read account"},{"value":"admin","description":"admin access"}]}',
        name: 'my resource'
      }
    };

    const yamlFile = writeStringToFile(path.join(dir, 'resources1.yaml'), yaml);
    const context = new Context(yamlFile, { name: 'my resource', identifier: 'http://myapi.com/api' });
    await context.init();

    expect(context.resourceServers).to.deep.equal(target);
  });
});

