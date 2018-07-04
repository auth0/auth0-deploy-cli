import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/yaml';
import { cleanThenMkdir, testDataDir, writeStringToFile } from 'test/utils';


describe('#context YAML validation', () => {
  it('should do nothing on empty yaml', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'yaml', 'empty');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    writeStringToFile(yaml, '');

    const context = new Context(yaml);
    await context.init();

    expect(context.rules).to.deep.equal({});
    expect(context.databases).to.deep.equal([]);
    expect(context.pages).to.deep.equal({});
    expect(context.clients).to.deep.equal({});
    expect(context.resourceServers).to.deep.equal({});
  });

  it('should error invalid schema', async () => {
    const dir = path.resolve(testDataDir, 'yaml', 'invalid');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'invalid.yaml');
    writeStringToFile(yaml, 'invalid');

    const context = new Context(yaml);
    await expect(context.init()).to.be.eventually.rejectedWith(Error);
  });

  it('should error on bad file', async () => {
    const yaml = path.resolve(testDataDir, 'yaml', 'notexist.yml');
    const context = new Context(yaml);
    await expect(context.init()).to.be.eventually.rejectedWith(Error);
  });
});
