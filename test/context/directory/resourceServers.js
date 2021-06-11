import fs from 'fs-extra';

import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/resourceServers';
import { loadJSON } from '../../../src/utils';
import {
  cleanThenMkdir, testDataDir, createDir, mockMgmtClient
} from '../../utils';

const resourceServers = {
  'myapi.json': '{ "name": "My API", "identifier": "https://##ENV##.myapp.com/api/v1", "scopes": [ { "value": "update:account", "description": "update account" }, { "value": "read:account", "description": "read account" } ] }'
};

const resourceServersTarget = [
  {
    identifier: 'https://##ENV##.myapp.com/api/v1',
    name: 'My API',
    scopes: [ { description: 'update account', value: 'update:account' }, { description: 'read account', value: 'read:account' } ]
  }
];

describe('#directory context resourceServers', () => {
  it('should process resourceServers', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'resourceServers1');
    createDir(repoDir, { [constants.RESOURCE_SERVERS_DIRECTORY]: resourceServers });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.resourceServers).to.deep.equal(resourceServersTarget);
  });

  it('should ignore unknown file', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'resourceServers2');
    const invalid = {
      ...resourceServers,
      'README.md': 'something'
    };
    createDir(repoDir, { [constants.RESOURCE_SERVERS_DIRECTORY]: invalid });
    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.resourceServers).to.deep.equal(resourceServersTarget);
  });

  it('should ignore bad resourceServers directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'resourceServers3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.RESOURCE_SERVERS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump resource servers', async () => {
    const dir = path.join(testDataDir, 'directory', 'resourceServersDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.resourceServers = [
      {
        identifier: 'http://myapi.com/api',
        name: 'my resource',
        scopes: [
          { description: 'update account', name: 'update:account' },
          { description: 'read account', name: 'read:account' },
          { description: 'admin access', name: 'admin' }
        ]
      }
    ];

    await handler.dump(context);
    const resourceServersFolder = path.join(dir, constants.RESOURCE_SERVERS_DIRECTORY);
    expect(loadJSON(path.join(resourceServersFolder, 'my resource.json'))).to.deep.equal(context.assets.resourceServers[0]);
  });

  it('should dump resource servers sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'resourceServersDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.resourceServers = [
      {
        identifier: 'http://myapi.com/api',
        name: 'my/test/ resource',
        scopes: [
          { description: 'update account', name: 'update:account' },
          { description: 'read account', name: 'read:account' },
          { description: 'admin access', name: 'admin' }
        ]
      }
    ];

    await handler.dump(context);
    const resourceServersFolder = path.join(dir, constants.RESOURCE_SERVERS_DIRECTORY);
    expect(loadJSON(path.join(resourceServersFolder, 'my-test- resource.json'))).to.deep.equal(context.assets.resourceServers[0]);
  });
});
