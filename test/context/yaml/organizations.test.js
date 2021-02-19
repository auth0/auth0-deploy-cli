import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/organizations';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context organizations', () => {
  it('should process organizations', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clients');
    cleanThenMkdir(dir);

    const yaml = `
    organizations:
      - name: acme
        branding:
          colors:
            primary: '#3678e2'
            page_background: '#9c4949'
        connections:
          - connection_id: con_123
            assign_membership_on_login: false
        display_name: acme
      - name: contoso
        branding:
          colors:
            primary: '#3678e2'
            page_background: '#9c4949'
        connections:
          - connection_id: con_456
            assign_membership_on_login: true
        display_name: contoso
    `;

    const target = [
      {
        name: 'acme',
        display_name: 'acme',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949'
          }
        },
        connections: [ {
          connection_id: 'con_123',
          assign_membership_on_login: false
        } ]
      },
      {
        name: 'contoso',
        display_name: 'contoso',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949'
          }
        },
        connections: [ {
          connection_id: 'con_456',
          assign_membership_on_login: true
        } ]
      }
    ];

    const yamlFile = path.join(dir, 'organizations.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.organizations).to.deep.equal(target);
  });

  it('should dump organizations', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './organizations.yml' }, mockMgmtClient());
    const organizations = [
      {
        name: 'acme',
        display_name: 'acme',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949'
          }
        },
        connections: [ {
          connection_id: 'con_123',
          assign_membership_on_login: false,
          connection: {
            name: 'foo',
            strategy: 'auth0'
          }
        } ]
      }
    ];
    context.assets.organizations = organizations;

    const dumped = await handler.dump(context);

    delete organizations[0].connections[0].connection;
    expect(dumped).to.deep.equal({ organizations });
  });
});
