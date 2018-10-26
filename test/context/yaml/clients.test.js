import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/clients';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context clients', () => {
  it('should process clients', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clients');
    cleanThenMkdir(dir);

    const yaml = `
    clients:
      -
        name: "someClient"
        app_type: @@appType@@
      -
        name: "someClient2"
        app_type: "##appType##"
    `;

    const target = [
      { app_type: 'spa', name: 'someClient' },
      { app_type: 'spa', name: 'someClient2' }
    ];

    const yamlFile = path.join(dir, 'clients1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { appType: 'spa' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.clients).to.deep.equal(target);
  });

  it('should dump clients', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const clients = [
      { name: 'someClient', app_type: 'spa' }
    ];
    context.assets.clients = clients;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ clients });
  });
});
