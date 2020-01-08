import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/roles';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';


describe('#directory context roles', () => {
  it('should process roles', async () => {
    const files = {
      [constants.ROLES_DIRECTORY]: {
        'role1.json': '{ "name": "App Admin", "description": "Admin of app","permissions": [ { "permission_name": "create:data", "resource_server_identifier": "urn:ref" } ] }',
        'role2.json': '{ "name": "App User", "description": "User of app","permissions": [ { "permission_name": "read:data", "resource_server_identifier": "urn:ref" } ] }'

      }
    };
    const repoDir = path.join(testDataDir, 'directory', 'roles1');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    const target = [
      {
        name: 'App Admin',
        description: 'Admin of app',
        permissions: [
          {
            permission_name: 'create:data', resource_server_identifier: 'urn:ref'
          }
        ]
      },
      {
        name: 'App User',
        description: 'User of app',
        permissions: [
          {
            permission_name: 'read:data', resource_server_identifier: 'urn:ref'
          }
        ]
      }
    ];
    expect(context.assets.roles).to.deep.equal(target);
  });

  it('should ignore unknown file', async () => {
    const files = {
      [constants.ROLES_DIRECTORY]: {
        'role1.json': '{ "name": "App Admin", "description": "Admin of app","permissions": [ { "permission_name": "create:data", "resource_server_identifier": "urn:ref" } ] }',
        'role2.json': '{ "name": "App User", "description": "User of app","permissions": [ { "permission_name": "read:data", "resource_server_identifier": "urn:ref" } ] }'
      }
    };

    const repoDir = path.join(testDataDir, 'directory', 'roles2');
    createDir(repoDir, files);

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    const target = [
      {
        name: 'App Admin',
        description: 'Admin of app',
        permissions: [
          {
            permission_name: 'create:data', resource_server_identifier: 'urn:ref'
          }
        ]
      },
      {
        name: 'App User',
        description: 'User of app',
        permissions: [
          {
            permission_name: 'read:data', resource_server_identifier: 'urn:ref'
          }
        ]
      }
    ];

    expect(context.assets.roles).to.deep.equal(target);
  });

  it('should ignore objects', async () => {
    const dir = path.join(testDataDir, 'directory', 'rolesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    // API will return an empty object if there are no roles
    context.assets.roles = {};

    await handler.dump(context);

    // folder should not be there
    const roleFolder = path.join(dir, constants.ROLES_DIRECTORY);
    expect(fs.existsSync(roleFolder)).is.equal(false);
  });

  it('should ignore bad roles directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'roles3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.ROLES_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());

    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump roles', async () => {
    const dir = path.join(testDataDir, 'directory', 'rolesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());

    context.assets.roles = [
      {
        name: 'App Admin',
        description: 'Admin of app',
        permissions: [
          {
            permission_name: 'create:data', resource_server_identifier: 'urn:ref'
          }
        ]
      },
      {
        name: 'App User',
        description: 'User of app',
        permissions: [
          {
            permission_name: 'read:data', resource_server_identifier: 'urn:ref'
          }
        ]
      }
    ];

    await handler.dump(context);
    const roleFolder = path.join(dir, constants.ROLES_DIRECTORY);
    expect(loadJSON(path.join(roleFolder, 'App Admin.json'))).to.deep.equal(context.assets.roles[0]);
    expect(loadJSON(path.join(roleFolder, 'App User.json'))).to.deep.equal(context.assets.roles[1]);
  });
});
