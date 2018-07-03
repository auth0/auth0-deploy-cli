import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/directory';
import { cleanThenMkdir, writeStringToFile, testDataDir, createDir } from 'test/utils';


describe('#context directory resource servers', () => {
  it('should process resource servers', async () => {
    const target = {
      'resource-servers': {
        resourceName: {
          configFile: '{ "some1Key": "some1Val" }',
          metadata: true,
          metadataFile: '{ "some1MetaKey": "som1eMetaVal" }',
          name: 'resourceName'
        }
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'resources1');
    createDir(repoDir, target);

    const context = new Context(repoDir, { somekey: 'someVal' });
    await context.init();
    expect(context.resourceServers).to.deep.equal(target['resource-servers']);
  });

  it('should ignore bad config file', async () => {
    const target = {
      'resource-servers': {
        resourceName: {
          configFile: '{ "some1Key": "some1Val" }',
          metadata: true,
          metadataFile: '{ "some1MetaKey": "som1eMetaVal" }',
          name: 'resourceName'
        }
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'resources2');
    createDir(repoDir, target);

    const dir = path.join(repoDir, constants.RESOURCE_SERVERS_DIRECTORY);
    const file = path.join(dir, 'README.md');
    writeStringToFile(file, 'something');

    const context = new Context(repoDir);
    await context.init();
    expect(context.resourceServers).to.deep.equal(target['resource-servers']);
  });

  it('should ignore bad configurables directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'configurables3');
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

