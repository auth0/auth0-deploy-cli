import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/directory';
import { cleanThenMkdir, writeStringToFile, testDataDir } from 'test/utils';

function createDbDir(databaseDir, data) {
  const dbDir = path.resolve(databaseDir, data.name);
  cleanThenMkdir(dbDir);

  Object.keys(data.scripts).forEach(scriptName =>
    writeStringToFile(
      path.join(dbDir, scriptName + '.js'),
      data.scripts[scriptName].scriptFile
    ));
}


describe('#context directory connections', () => {
  it('should process database connections', async () => {
    const target = [
      {
        name: 'db1',
        scripts: {
          login: {
            scriptFile: 'function login() { var hello = @@hello@@; }'
          },
          create: {
            scriptFile: 'function create() { }'
          },
          delete: {
            scriptFile: 'function delete() { }'
          },
          change_email: {
            scriptFile: 'function change_email() { }'
          },
          get_user: {
            scriptFile: 'function get_user() { }'
          }
        }
      },
      {
        name: 'db2',
        scripts: {
          login: {
            scriptFile: 'function login2() { }'
          },
          create: {
            scriptFile: 'function create2() { }'
          }
        }
      }
    ];

    const repoDir = path.join(testDataDir, 'directory', 'connections1');
    const dbDir = path.join(
      repoDir,
      constants.DATABASE_CONNECTIONS_DIRECTORY
    );
    target.forEach(data => createDbDir(dbDir, data));

    const context = new Context(repoDir, { hello: 'goodbye' });
    await context.init();
    target[0].scripts.login.scriptFile =
      'function login() { var hello = "goodbye"; }';
    expect(context.databases).to.deep.equal(target);
  });

  it('should ignore bad filename', async () => {
    const target = [
      {
        name: 'db1',
        scripts: {
          login: {
            scriptFile: 'function login() { }'
          },
          createBad: {
            scriptFile: 'function create() { }'
          }
        }
      }
    ];

    const repoDir = path.join(testDataDir, 'directory', 'connections2');
    const dbDir = path.join(
      repoDir,
      constants.DATABASE_CONNECTIONS_DIRECTORY
    );
    const db2Dir = path.join(dbDir, 'db1');
    target.forEach(data => createDbDir(dbDir, data));
    writeStringToFile(path.join(db2Dir, 'junk.json'), 'junk');
    delete target[0].scripts.createBad;

    const context = new Context(repoDir);
    await context.init();
    expect(context.databases).to.deep.equal(target);
  });

  it('should ignore bad connections directory', async () => {
    const target = [
      {
        name: 'db1',
        scripts: {
          login: {
            scriptFile: 'function login() { }'
          }
        }
      }
    ];

    const repoDir = path.join(testDataDir, 'directory', 'connections2');
    const dbDir = path.join(
      repoDir,
      constants.DATABASE_CONNECTIONS_DIRECTORY
    );
    target.forEach(data => createDbDir(dbDir, data));
    writeStringToFile(path.join(dbDir, '.DSStore'), 'junk');

    const context = new Context(repoDir);
    await context.init();
    expect(context.databases).to.deep.equal(target);
  });

  it('should ignore bad scripts directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'connections3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.DATABASE_CONNECTIONS_DIRECTORY);
    writeStringToFile(dir, 'junk');

    const context = new Context(repoDir);
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.init())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });
});
