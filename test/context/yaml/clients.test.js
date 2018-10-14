import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context YAML clients', () => {
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

    const yamlFile = writeStringToFile(path.join(dir, 'clients1.yaml'), yaml);


    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { appType: 'spa' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.clients).to.deep.equal(target);
  });
});
