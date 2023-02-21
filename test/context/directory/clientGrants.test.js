import fs from 'fs-extra';

import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/clientGrants';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';
import { getFiles, loadJSON } from '../../../src/utils';

describe('#directory context clientGrants', () => {
  it('should process clientGrants', async () => {
    const files = {
      [constants.CLIENTS_GRANTS_DIRECTORY]: {
        'Primary M2M-Auth0 Management API.json': `
        {
          "audience": "https://travel0.us.auth0.com/api/v2",
          "client_id": "client-id-1",
          "scope": ["read:users"]
        }`,
        'Primary M2M-Payments Service.json': `
        {
          "audience": "https://payments.travel0.com/api",
          "client_id": "client-id-1",
          "scope": ["update:card", "create:card", "delete:card"]
        }`,
        'some-arbitrary-filename.json': `
        {
          "audience": "https://payments.travel0.com/api",
          "client_id": "client-id-2",
          "scope": ["update:card", "create:card", "delete:card"]
        }`,
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clientGrants1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { var: 'something' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.clientGrants).to.deep.equal([
      {
        audience: 'https://travel0.us.auth0.com/api/v2',
        client_id: 'client-id-1',
        scope: ['read:users'],
      },

      {
        audience: 'https://payments.travel0.com/api',
        client_id: 'client-id-1',
        scope: ['update:card', 'create:card', 'delete:card'],
      },
      {
        audience: 'https://payments.travel0.com/api',
        client_id: 'client-id-2',
        scope: ['update:card', 'create:card', 'delete:card'],
      },
    ]);
  });

  it('should ignore unknown file', async () => {
    const files = {
      [constants.CLIENTS_GRANTS_DIRECTORY]: {
        'test.json': `
          {
           "client_id": "auth0-webhooks",
           "audience": "https://test.auth0.com/api/v2/",
           "scope": [
              "read:logs"
           ],
           "var": @@var@@
          }`,
        'README.md': 'something',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clientGrants2');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { var: 'something' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      {
        audience: 'https://test.auth0.com/api/v2/',
        client_id: 'auth0-webhooks',
        scope: ['read:logs'],
        var: 'something',
      },
    ];

    expect(context.assets.clientGrants).to.deep.equal(target);
  });

  it('should ignore bad clientGrants directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'clientGrants3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.CLIENTS_GRANTS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump client grants', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientGrantsDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: dir },
      {
        ...mockMgmtClient(),
        clients: {
          getAll: () => [
            {
              client_id: 'client-id-1',
              name: 'Primary M2M',
            },
            {
              client_id: 'client-id-2',
              name: 'Secondary M2M',
            },
          ],
        },
        resourceServers: {
          getAll: () => [
            {
              id: 'resource-server-1',
              name: 'Payments Service',
              identifier: 'https://payments.travel0.com/api',
            },
            {
              id: 'resource-server-2',
              name: 'Auth0 Management API',
              identifier: 'https://travel0.us.auth0.com/api/v2',
            },
          ],
        },
      }
    );

    context.assets.clientGrants = [
      {
        audience: 'https://travel0.us.auth0.com/api/v2',
        client_id: 'client-id-1',
        scope: ['read:users'],
      },
      {
        audience: 'https://payments.travel0.com/api',
        client_id: 'client-id-1',
        scope: ['update:card', 'create:card', 'delete:card'],
      },
      {
        audience: 'https://payments.travel0.com/api',
        client_id: 'client-id-2',
        scope: ['update:card', 'create:card', 'delete:card'],
      },
    ];

    await handler.dump(context);
    const clientGrantsFolder = path.join(dir, constants.CLIENTS_GRANTS_DIRECTORY);

    const files = getFiles(clientGrantsFolder, ['.json']);

    expect(files).to.have.length(context.assets.clientGrants.length);
    expect(files).to.have.members([
      path.join(clientGrantsFolder, 'Primary M2M-Auth0 Management API.json'),
      path.join(clientGrantsFolder, 'Primary M2M-Payments Service.json'),
      path.join(clientGrantsFolder, 'Secondary M2M-Payments Service.json'),
    ]);

    expect(
      loadJSON(path.join(clientGrantsFolder, 'Primary M2M-Auth0 Management API.json'))
    ).to.deep.equal(context.assets.clientGrants[0]);
    expect(
      loadJSON(path.join(clientGrantsFolder, 'Primary M2M-Payments Service.json'))
    ).to.deep.equal(context.assets.clientGrants[1]);
    expect(
      loadJSON(path.join(clientGrantsFolder, 'Secondary M2M-Payments Service.json'))
    ).to.deep.equal(context.assets.clientGrants[2]);
  });

  it('should not fetch clients and resource servers if no client grants defined', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientGrantsDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: dir },
      {
        ...mockMgmtClient(),
        clients: {
          getAll: () => {
            throw new 'This should not be called'();
          },
        },
        resourceServers: {
          getAll: () => {
            throw new 'This should not be called'();
          },
        },
      }
    );

    const EMPTY_CLIENT_GRANTS = [];

    context.assets.clientGrants = EMPTY_CLIENT_GRANTS;

    await handler.dump(context);
    const clientGrantsFolder = path.join(dir, constants.CLIENTS_GRANTS_DIRECTORY);

    const files = getFiles(clientGrantsFolder, ['.json']);

    expect(files).to.have.length(EMPTY_CLIENT_GRANTS);
  });
});
