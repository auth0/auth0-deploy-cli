import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context YAML validation', () => {
  it('should do nothing on empty yaml', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'empty');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    writeStringToFile(yaml, '');

    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.rules).to.deep.equal([]);
    expect(context.assets.databases).to.deep.equal([]);
    expect(context.assets.pages).to.deep.equal([]);
    expect(context.assets.clients).to.deep.equal([]);
    expect(context.assets.resourceServers).to.deep.equal([]);
  });

  it('should error invalid schema', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'invalid');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'invalid.yaml');
    writeStringToFile(yaml, 'invalid');

    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await expect(context.load()).to.be.eventually.rejectedWith(Error);
  });

  it('should error on bad file', async () => {
    const yaml = path.resolve(testDataDir, 'yaml', 'notexist.yml');
    const config = { AUTH0_INPUT_FILE: yaml };
    const context = new Context(config, mockMgmtClient());
    await expect(context.load()).to.be.eventually.rejectedWith(Error);
  });

  it('should load relative file', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'script');
    cleanThenMkdir(dir);
    const script = path.join(dir, 'script.js');
    writeStringToFile(script, '// empty');

    const config = { AUTH0_INPUT_FILE: '' };
    const context = new Context(config, mockMgmtClient());
    expect(context.loadFile(script.replace(context.basePath, '.'))).to.equal('// empty');
  });

  it('should load full path file', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'script');
    cleanThenMkdir(dir);
    const script = path.join(dir, 'script.js');
    writeStringToFile(script, '// empty');

    const config = { AUTH0_INPUT_FILE: '' };
    const context = new Context(config, mockMgmtClient());
    expect(context.loadFile(script)).to.equal('// empty');
  });
});
