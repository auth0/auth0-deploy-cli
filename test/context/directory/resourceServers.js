import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/resourceServers';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

const resourceServers = {
  'myapi.json':
    '{ "name": "My API", "identifier": "https://##ENV##.myapp.com/api/v1", "scopes": [ { "value": "update:account", "description": "update account" }, { "value": "read:account", "description": "read account" } ] }',
};

const resourceServersTarget = [
  {
    identifier: 'https://##ENV##.myapp.com/api/v1',
    name: 'My API',
    scopes: [
      { description: 'update account', value: 'update:account' },
      { description: 'read account', value: 'read:account' },
    ],
  },
];

describe('#directory context resourceServers', () => {
  it('should process resourceServers', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'resourceServers1');
    createDir(repoDir, { [constants.RESOURCE_SERVERS_DIRECTORY]: resourceServers });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.resourceServers).to.deep.equal(resourceServersTarget);
  });

  it('should ignore unknown file', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'resourceServers2');
    const invalid = {
      ...resourceServers,
      'README.md': 'something',
    };
    createDir(repoDir, { [constants.RESOURCE_SERVERS_DIRECTORY]: invalid });
    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

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
    await expect(context.loadAssetsFromLocal())
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
          { description: 'admin access', name: 'admin' },
        ],
      },
    ];

    await handler.dump(context);
    const resourceServersFolder = path.join(dir, constants.RESOURCE_SERVERS_DIRECTORY);
    expect(loadJSON(path.join(resourceServersFolder, 'my resource.json'))).to.deep.equal(
      context.assets.resourceServers[0]
    );
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
          { description: 'admin access', name: 'admin' },
        ],
      },
    ];

    await handler.dump(context);
    const resourceServersFolder = path.join(dir, constants.RESOURCE_SERVERS_DIRECTORY);
    expect(loadJSON(path.join(resourceServersFolder, 'my-test- resource.json'))).to.deep.equal(
      context.assets.resourceServers[0]
    );
  });

  it('should handle resourceServers with client_id and load clients from API', async () => {
    const dir = path.join(testDataDir, 'directory', 'resourceServersWithClientId');
    cleanThenMkdir(dir);

    const mockClient = mockMgmtClient();
    mockClient.clients = {
      getAll: (params) => {
        const clients = [
          { client_id: 'client_123', name: 'Test Client' },
          { client_id: 'client_456', name: 'Another Client' },
        ];
        if (params && params.include_totals) {
          return { data: { clients, total: clients.length } };
        }
        return { data: clients };
      },
    };

    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockClient);

    context.assets.resourceServers = [
      {
        identifier: 'http://api.example.com',
        name: 'API with Client',
        client_id: 'client_123',
      },
      {
        identifier: 'http://api2.example.com',
        name: 'API without Client',
        // no client_id
      },
    ];

    // Don't provide clients in assets to trigger API call
    context.assets.clients = undefined;

    await handler.dump(context);

    const resourceServersFolder = path.join(dir, constants.RESOURCE_SERVERS_DIRECTORY);

    // Check resource server with client_id conversion
    const dumpedWithClient = loadJSON(path.join(resourceServersFolder, 'API with Client.json'));
    expect(dumpedWithClient.client_id).to.equal('Test Client');
    expect(dumpedWithClient.name).to.equal('API with Client');

    // Check resource server without client_id
    const dumpedWithoutClient = loadJSON(
      path.join(resourceServersFolder, 'API without Client.json')
    );
    expect(dumpedWithoutClient).to.not.have.property('client_id');
    expect(dumpedWithoutClient.name).to.equal('API without Client');
  });

  it('should convert client_id to client name when clients already in context', async () => {
    const dir = path.join(testDataDir, 'directory', 'resourceServersClientIdExisting');
    cleanThenMkdir(dir);

    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.resourceServers = [
      {
        identifier: 'http://api.example.com',
        name: 'API with Client',
        client_id: 'client_123',
      },
    ];

    // Provide clients in assets so API call is not triggered
    context.assets.clients = [
      { client_id: 'client_123', name: 'Existing Test Client' },
      { client_id: 'client_456', name: 'Another Existing Client' },
    ];

    await handler.dump(context);

    const resourceServersFolder = path.join(dir, constants.RESOURCE_SERVERS_DIRECTORY);
    const dumpedResourceServer = loadJSON(path.join(resourceServersFolder, 'API with Client.json'));

    expect(dumpedResourceServer.client_id).to.equal('Existing Test Client');
    expect(dumpedResourceServer.name).to.equal('API with Client');
    expect(dumpedResourceServer.identifier).to.equal('http://api.example.com');
  });
});
