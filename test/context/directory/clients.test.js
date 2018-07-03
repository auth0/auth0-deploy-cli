import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/directory';
import { cleanThenMkdir, writeStringToFile, testDataDir, createDir } from 'test/utils';


describe('#context clients', () => {
  it('should process clients', async () => {
    const target = {
      clients: {
        someClient: {
          configFile: '{ "someKey": "someVal" }',
          name: 'someClient'
        },
        someClient2: {
          configFile: '{ "someKey": @@somekey@@ }',
          metadata: true,
          metadataFile: '{ "someMetaKey": "someMetaVal" }',
          name: 'someClient2'
        }
      }
    };

    const repoDir = path.join(testDataDir, 'clients1');
    createDir(repoDir, target);

    const context = new Context(repoDir, { somekey: 'someVal' });
    await context.init();
    target.clients.someClient2.configFile = '{ "someKey": "someVal" }';
    expect(context.clients).to.deep.equal(target.clients);
  });

  it('should ignore bad config file', async () => {
    const target = {
      clients: {
        someClient: {
          configFile: '{ "someKey": "someVal" }',
          name: 'someClient'
        }
      }
    };

    const repoDir = path.join(testDataDir, 'clients2');
    createDir(repoDir, target);

    const dir = path.join(repoDir, constants.CLIENTS_DIRECTORY);
    const file = path.join(dir, 'README.md');
    writeStringToFile(file, 'something');

    const context = new Context(repoDir);
    await context.init();
    expect(context.clients).to.deep.equal(target.clients);
  });

  it('should ignore bad pages directory', async () => {
    const repoDir = path.join(testDataDir, 'clients3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.CLIENTS_DIRECTORY);
    writeStringToFile(dir, 'junk');

    const context = new Context(repoDir);
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.init())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });
});

