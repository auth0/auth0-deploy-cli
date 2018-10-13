import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context rules configs', () => {
  it('should process rules configs', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rulesConfigs');
    cleanThenMkdir(dir);

    const yaml = `
    rulesConfigs:
      - key: "SOME_SECRET"
        value: 'some_key'
    `;
    const yamlFile = writeStringToFile(path.join(dir, 'config.yaml'), yaml);

    const target = [
      {
        key: 'SOME_SECRET',
        value: 'some_key'
      }
    ];

    const context = new Context(yamlFile, {}, null, mockMgmtClient());
    await context.load();
    expect(context.assets.rulesConfigs).to.deep.equal(target);
  });
});
