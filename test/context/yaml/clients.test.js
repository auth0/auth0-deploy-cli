import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/yaml';
import { cleanThenMkdir, testDataDir, writeStringToFile } from 'test/utils';


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

    const target = {
      someClient: {
        configFile: '{"name":"someClient","app_type":"spa"}',
        name: 'someClient'
      },
      someClient2: {
        configFile: '{"name":"someClient2","app_type":"spa"}',
        name: 'someClient2'
      }
    };

    const yamlFile = writeStringToFile(path.join(dir, 'clients1.yaml'), yaml);
    const context = new Context(yamlFile, { appType: 'spa' });
    await context.init();

    expect(context.clients).to.deep.equal(target);
  });
});
