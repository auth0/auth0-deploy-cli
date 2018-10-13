import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context tenant settings', () => {
  it('should process tenant settings', async () => {
    const dir = path.join(testDataDir, 'yaml', 'tenant');
    cleanThenMkdir(dir);

    const yaml = `
    tenant:
      friendly_name: 'Auth0 ##ENV##'
    `;
    const yamlFile = writeStringToFile(path.join(dir, 'config.yaml'), yaml);

    const target = {
      friendly_name: 'Auth0 test'
    };

    const context = new Context(yamlFile, { ENV: 'test' }, null, mockMgmtClient());
    await context.load();
    expect(context.assets.tenant).to.deep.equal(target);
  });
});
