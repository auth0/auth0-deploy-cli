import path from 'path';

import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/flowVaultConnections';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

describe('#directory context flowVaultConnections', () => {
  it('should process flowVaultConnections', async () => {
    const files = {
      [constants.FLOWS_VAULT_DIRECTORY]: {
        'Auth0 M2M Con #1.json':
          '{ "name": "Auth0 M2M Con #1", "account_name": "domain_name", "app_id": "AUTH0", "ready": true }',
        'HTTP Con #1.json': '{ "name": "HTTP Con #1", "app_id": "HTTP", "ready": false }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'flowVaultConnections');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    const target = [
      { name: 'Auth0 M2M Con #1', account_name: 'domain_name', app_id: 'AUTH0', ready: true },
      { name: 'HTTP Con #1', app_id: 'HTTP', ready: false },
    ];
    expect(context.assets.flowVaultConnections).to.deep.equal(target);
  });

  it('should apply keyword mappings to setup', async () => {
    const files = {
      [constants.FLOWS_VAULT_DIRECTORY]: {
        'Token Con.json':
          '{ "name": "Token Con", "app_id": "HTTP", "setup": { "type": "BEARER", "token": "##TOKEN##" } }',
        'Object Con.json':
          '{ "name": "Object Con", "app_id": "HTTP", "setup": "@@SETUP_CONFIG@@" }',
      },
    };

    const repoDir = path.join(testDataDir, 'directory', 'flowVaultConnectionsSetupMappings');
    createDir(repoDir, files);

    const config = {
      AUTH0_INPUT_FILE: repoDir,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: {
        TOKEN: 'secret-token',
        SETUP_CONFIG: { type: 'BEARER', token: 'object-token' },
      },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.flowVaultConnections).to.deep.equal([
      { name: 'Object Con', app_id: 'HTTP', setup: { type: 'BEARER', token: 'object-token' } },
      {
        name: 'Token Con',
        app_id: 'HTTP',
        setup: { type: 'BEARER', token: 'secret-token' },
      },
    ]);
  });

  it('should dump flowVaultConnections sanitized', async () => {
    const dir = path.join(testDataDir, 'directory', 'flowVaultConnectionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.flowVaultConnections = [
      { name: 'Auth0 M2M Con #1', account_name: 'domain_name', app_id: 'AUTH0', ready: true },
      { name: 'HTTP Con #1', app_id: 'HTTP', ready: false },
    ];

    await handler.dump(context);
    const clientFolder = path.join(dir, constants.FLOWS_VAULT_DIRECTORY);
    expect(loadJSON(path.join(clientFolder, 'Auth0 M2M Con #1.json'))).to.deep.equal({
      name: 'Auth0 M2M Con #1',
      app_id: 'AUTH0',
    });
    expect(loadJSON(path.join(clientFolder, 'HTTP Con #1.json'))).to.deep.equal({
      name: 'HTTP Con #1',
      app_id: 'HTTP',
    });
  });
});
