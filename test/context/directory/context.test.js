import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { cleanThenMkdir, testDataDir } from '../../utils';


describe('#directory context validation', () => {
  it('should do nothing on empty repo', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'directory', 'empty');
    cleanThenMkdir(dir);

    const context = new Context({ AUTH0_INPUT_FILE: dir });
    await context.load();

    Object.entries(context.assets).forEach(([ k, v ]) => {
      if (typeof v === 'undefined') delete context.assets[k];
    });

    expect(context.assets).to.have.all.keys('exclude');
  });

  it('should load excludes', async () => {
    /* Create empty directory */
    const dir = path.resolve(testDataDir, 'directory', 'empty');
    cleanThenMkdir(dir);

    const config = {
      AUTH0_INPUT_FILE: dir,
      AUTH0_EXCLUDED_RULES: [ 'rule' ],
      AUTH0_EXCLUDED_CLIENTS: [ 'client' ],
      AUTH0_EXCLUDED_DATABASES: [ 'db' ],
      AUTH0_EXCLUDED_CONNECTIONS: [ 'conn' ],
      AUTH0_EXCLUDED_RESOURCE_SERVERS: [ 'api' ],
      AUTH0_EXCLUDED_DEFAULTS: [ 'emailProvider' ]
    };
    const context = new Context(config);
    await context.load();

    expect(context.assets.exclude.rules).to.deep.equal([ 'rule' ]);
    expect(context.assets.exclude.clients).to.deep.equal([ 'client' ]);
    expect(context.assets.exclude.databases).to.deep.equal([ 'db' ]);
    expect(context.assets.exclude.connections).to.deep.equal([ 'conn' ]);
    expect(context.assets.exclude.resourceServers).to.deep.equal([ 'api' ]);
    expect(context.assets.exclude.defaults).to.deep.equal([ 'emailProvider' ]);
  });

  it('should error on bad directory', async () => {
    const dir = path.resolve(testDataDir, 'directory', 'doesNotExist');
    const context = new Context({ AUTH0_INPUT_FILE: dir });
    const errorMessage = `Not sure what to do with, ${dir} as it is not a directory...`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should error on symlink', async () => {
    const dir = path.resolve(testDataDir, 'directory', 'badSymlink');
    const file = path.join(dir, 'badSymLink');
    const link = path.join(dir, 'link');
    try {
      fs.unlinkSync(link);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    cleanThenMkdir(dir);
    fs.symlinkSync(file, link);

    const context = new Context({ AUTH0_INPUT_FILE: link });
    const errorMessage = `Not sure what to do with, ${link} as it is not a directory...`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });
});
