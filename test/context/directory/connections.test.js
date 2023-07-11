import fs from 'fs-extra';

import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/connections';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context connections', () => {
  it('should process connections', async () => {
    const files = {
      [constants.CONNECTIONS_DIRECTORY]: {
        'azuread.json': '{ "name": "myad-waad", "strategy": "waad", "var": @@var@@ }',
        'facebook.json': '{  "name": "facebook", "strategy": "facebook", "var": @@var@@ }',
        'email.json':
          '{  "name": "email", "strategy": "email", "var": @@var@@, "options": { "email": { "body": "./email.html" } } }',
        'email.html': 'html code with ##secret##',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'connections1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { secret: 'test secret', var: 'something' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      { name: 'myad-waad', strategy: 'waad', var: 'something' },
      {
        name: 'email',
        strategy: 'email',
        var: 'something',
        options: { email: { body: 'html code with test secret' } },
      },
      { name: 'facebook', strategy: 'facebook', var: 'something' },
    ];

    expect(context.assets.connections).to.deep.equal(target);
  });

  it('should process a custom connections directory', async () => {
    const customConnectionDirectory = 'connections-custom';

    const files = {
      [customConnectionDirectory]: {
        'a-connection.json': '{ "name": "A Connection" }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'connections1');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_CONNECTIONS_DIRECTORY: customConnectionDirectory,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [{ name: 'A Connection' }];

    expect(context.assets.connections).to.deep.equal(target);
  });

  it('should ignore unknown file', async () => {
    const files = {
      [constants.CONNECTIONS_DIRECTORY]: {
        'azuread.json': '{ "name": "myad-waad", "strategy": "waad", "var": @@var@@ }',
        'README.md': 'something',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'connections2');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { var: 'something' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [{ name: 'myad-waad', strategy: 'waad', var: 'something' }];

    expect(context.assets.connections).to.deep.equal(target);
  });

  it('should ignore bad connections directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'connections3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.CONNECTIONS_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.loadAssetsFromLocal())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump connections', async () => {
    const dir = path.join(testDataDir, 'directory', 'connectionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.connections = [
      {
        name: 'myad-waad',
        strategy: 'waad',
        var: 'something',
        enabled_clients: [],
      },
      {
        name: 'facebook',
        strategy: 'facebook',
        var: 'something',
        enabled_clients: [],
      },
      {
        name: 'email',
        strategy: 'email',
        enabled_clients: [],
        options: { email: { body: 'html code' } },
      },
    ];

    const emailTarget = {
      name: 'email',
      strategy: 'email',
      enabled_clients: [],
      options: { email: { body: './email.html' } },
    };

    await handler.dump(context);
    const connectionsFolder = path.join(dir, constants.CONNECTIONS_DIRECTORY);
    expect(loadJSON(path.join(connectionsFolder, 'myad-waad.json'))).to.deep.equal(
      context.assets.connections[0]
    );
    expect(loadJSON(path.join(connectionsFolder, 'facebook.json'))).to.deep.equal(
      context.assets.connections[1]
    );
    expect(loadJSON(path.join(connectionsFolder, 'email.json'))).to.deep.equal(emailTarget);
    expect(fs.readFileSync(path.join(connectionsFolder, 'email.html'), 'utf8')).to.deep.equal(
      'html code'
    );
  });

  it('should dump connections sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'connectionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.connections = [
      {
        name: 'my/ad-waad',
        strategy: 'waad',
        var: 'something',
        enabled_clients: [],
      },
    ];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.CONNECTIONS_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'my-ad-waad.json'))).to.deep.equal(
      context.assets.connections[0]
    );
  });

  it('should dump connections with enabled_clients sorted', async () => {
    const dir = path.join(testDataDir, 'directory', 'connectionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.connections = [
      {
        name: 'my/ad-waad',
        strategy: 'waad',
        var: 'something',
        enabled_clients: ['client2', 'client3', 'client1'],
      },
    ];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.CONNECTIONS_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'my-ad-waad.json')).enabled_clients).to.deep.equal([
      'client1',
      'client2',
      'client3',
    ]);
  });

  it('should throw error and halt deployment if passwordless email template is missing', async () => {
    const files = {
      [constants.CONNECTIONS_DIRECTORY]: {
        'email.json':
          '{  "name": "email", "strategy": "email", "options": { "email": { "body": "./email.html" } } }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'connections4');
    createDir(repoDir, files);
    // Intentionally skip creation of `./email.html` file

    const context = new Context(
      {
        AUTH0_INPUT_FILE: repoDir,
      },
      mockMgmtClient()
    );

    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      `Passwordless email template purportedly located at ${path.join(
        repoDir,
        'connections',
        'email.html'
      )} does not exist for connection. Ensure the existence of this file to proceed with deployment.`
    );
  });
});
