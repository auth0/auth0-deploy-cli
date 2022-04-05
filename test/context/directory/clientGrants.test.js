import fs from 'fs-extra';

import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/clientGrants';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';
import { loadJSON } from '../../../src/utils';

describe('#directory context clientGrants', () => {
  it('should process clientGrants', async () => {
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
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'clientGrants1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { var: 'something' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.load();

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
    await context.load();

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
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump client grants', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientGrantsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clientGrants = [
      { audience: 'https://test.myapp.com/api/v1', client_id: 'My M2M', scope: ['update:account'] },
    ];

    await handler.dump(context);
    const clientGrantsFolder = path.join(dir, constants.CLIENTS_GRANTS_DIRECTORY);
    expect(
      loadJSON(path.join(clientGrantsFolder, 'My M2M (https---test.myapp.com-api-v1).json'))
    ).to.deep.equal(context.assets.clientGrants[0]);
  });

  it('should dump client grants sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'clientGrantsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.clientGrants = [
      { audience: 'https://test.myapp.com/api/v1', client_id: 'My M2M', scope: ['update:account'] },
    ];

    await handler.dump(context);
    const clientGrantsFolder = path.join(dir, constants.CLIENTS_GRANTS_DIRECTORY);
    expect(
      loadJSON(path.join(clientGrantsFolder, 'My M2M (https---test.myapp.com-api-v1).json'))
    ).to.deep.equal(context.assets.clientGrants[0]);
  });
});
