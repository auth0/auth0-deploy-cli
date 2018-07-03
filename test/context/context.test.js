import path from 'path';
import { expect } from 'chai';

import context from 'src/context';
import directoryContext from 'src/context/directory';
import yamlContext from 'src/context/yaml';
import { cleanThenMkdir, testDataDir, writeStringToFile } from 'test/utils';

describe('#context loader validation', () => {
  it('should error on bad file', () => {
    const dir = path.resolve(testDataDir, 'notexist');
    expect(() => new context(dir)).to.throw(Error);
  });

  it('should load directory context', () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const loaded = new context(dir);
    expect(loaded).to.be.an.instanceof(directoryContext);
  });

  it('should load yaml context', () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'context');
    cleanThenMkdir(dir);
    const yaml = path.join(dir, 'empty.yaml');
    writeStringToFile(yaml, '');
    const yml = path.join(dir, 'empty.yml');
    writeStringToFile(yml, '');

    const loaded = new context(yaml);
    expect(loaded).to.be.an.instanceof(yamlContext);

    const loaded2 = new context(yml);
    expect(loaded2).to.be.an.instanceof(yamlContext);
  });
});
