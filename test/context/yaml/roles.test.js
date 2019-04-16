import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/roles';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context roles', () => {
  it('should process roles', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clients');
    cleanThenMkdir(dir);

    const yaml = `
    roles:
      - name: App Admin
        description: Admin of app
        permissions:
          - permission_name: 'create:data'
            resource_server_identifier: 'urn:ref'
      - name: App User
        description: 'User of app'
        permissions:
          - permission_name: 'read:data'
            resource_server_identifier: 'urn:ref'
    `;

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

    const yamlFile = path.join(dir, 'roles.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile};
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.roles).to.deep.equal(target);
  });

  it('should dump roles', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './roles.yml' }, mockMgmtClient());
    const roles = [
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
    context.assets.roles = roles;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ roles });
  });
});
