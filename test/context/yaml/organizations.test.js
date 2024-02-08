import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { cloneDeep } from 'lodash';

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
            show_as_button: false
        display_name: acme
      - name: contoso
        branding:
          colors:
            primary: '#3678e2'
            page_background: '#9c4949'
        connections:
          - connection_id: con_456
            assign_membership_on_login: true
            show_as_button: true
        display_name: contoso
    `;

    const target = [
      {
        name: 'acme',
        display_name: 'acme',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            connection_id: 'con_123',
            assign_membership_on_login: false,
            show_as_button: false,
          },
        ],
      },
      {
        name: 'contoso',
        display_name: 'contoso',
        branding: {
          colors: {
            primary: '#3678e2',
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            connection_id: 'con_456',
            assign_membership_on_login: true,
            show_as_button: true,
          },
        ],
      },
    ];

    const yamlFile = path.join(dir, 'organizations.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
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
            page_background: '#9c4949',
          },
        },
        connections: [
          {
            connection_id: 'con_123',
            assign_membership_on_login: false,
            show_as_button: false,
            connection: {
              name: 'foo',
              strategy: 'auth0',
            },
          },
        ],
      },
    ];
    context.assets.organizations = cloneDeep(organizations);
    const dumped = await handler.dump(context);

    organizations[0].connections[0].name = organizations[0].connections[0].connection.name;
    delete organizations[0].connections[0].connection;
    delete organizations[0].connections[0].connection_id;

    expect(dumped).to.deep.equal({ organizations });
  });
});
