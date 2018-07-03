import fs from 'fs';
import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/directory';
import { cleanThenMkdir, testDataDir } from 'test/utils';


describe('#context validation', () => {
  it('should do nothing on empty repo', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'empty');
    cleanThenMkdir(dir);

    const context = new Context(dir);
    await context.init();

    expect(context.rules).to.deep.equal({});
    expect(context.databases).to.deep.equal([]);
    expect(context.pages).to.deep.equal({});
    expect(context.clients).to.deep.equal({});
    expect(context.resourceServers).to.deep.equal({});
  });

  it('should error on bad directory', async () => {
    const dir = path.resolve(testDataDir, 'doesNotExist');
    const context = new Context(dir);
    const errorMessage = `Not sure what to do with, ${dir} as it is not a directory...`;
    await expect(context.init())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should error on symlink', async () => {
    const dir = path.resolve(testDataDir, 'badSymlink');
    const file = path.join(dir, 'badSymLink');
    const link = path.join(dir, 'link');
    try {
      fs.unlinkSync(link);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    cleanThenMkdir(dir);
    fs.symlinkSync(file, link);

    const context = new Context(link);
    const errorMessage = `Not sure what to do with, ${link} as it is not a directory...`;
    await expect(context.init())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });
});
