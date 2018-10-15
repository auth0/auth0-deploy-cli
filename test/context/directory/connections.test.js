import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/connections';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';


describe('#directory context connections', () => {
  it('should process connections', async () => {
    const files = {
      [constants.CONNECTIONS_DIRECTORY]: {
        'azuread.json': '{ "name": "myad-waad", "strategy": "waad", "var": @@var@@ }',
        'facebook.json': '{  "name": "facebook", "strategy": "facebook", "var": @@var@@ }'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'connections1');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { var: 'something' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    const target = [
      { name: 'myad-waad', strategy: 'waad', var: 'something' },
      { name: 'facebook', strategy: 'facebook', var: 'something' }
    ];

    expect(context.assets.connections).to.deep.equal(target);
  });

  it('should ignore unknown file', async () => {
    const files = {
      [constants.CONNECTIONS_DIRECTORY]: {
        'azuread.json': '{ "name": "myad-waad", "strategy": "waad", "var": @@var@@ }',
        'README.md': 'something'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'connections2');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { var: 'something' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    const target = [
      { name: 'myad-waad', strategy: 'waad', var: 'something' }
    ];

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
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });


  it('should dump connections', async () => {
    const dir = path.join(testDataDir, 'directory', 'connectionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.connections = [
      { name: 'myad-waad', strategy: 'waad', var: 'something' },
      { name: 'facebook', strategy: 'facebook', var: 'something' }
    ];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.CONNECTIONS_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'myad-waad.json'))).to.deep.equal(context.assets.connections[0]);
    expect(loadJSON(path.join(clientFolder, 'facebook.json'))).to.deep.equal(context.assets.connections[1]);
  });
});
