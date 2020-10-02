import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/connections';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


describe('#YAML context connections', () => {
  it('should process connections', async () => {
    const dir = path.join(testDataDir, 'yaml', 'connections1');
    cleanThenMkdir(dir);

    const yaml = `
    connections:
      - name: "##name##"
        strategy: "waad"
        options:
          tenant_domain: @@domain@@
          client_id: "my_client_id"
          client_secret: "my_secret"
          domain: somedomain.com
          waad_protocol: "openid-connect"
          api_enable_users: true
          basic_profile: true
          ext_profile: true
          ext_groups: true
      - name: "email"
        strategy: "email"
        options:
          email:
            body: "./email.html"
      - name: "someSamlConnection"
        strategy: "samlp"
        enabled_clients:
          - "client1"
        options:
          passwordPolicy: "testPolicy"
          idpinitiated:
            client_id: "idp-one"
            client_protocol: samlp
            client_authorizequery: ""
    `;

    const target = [
      {
        name: 'test-waad',
        options: {
          api_enable_users: true,
          basic_profile: true,
          client_id: 'my_client_id',
          client_secret: 'my_secret',
          domain: 'somedomain.com',
          ext_groups: true,
          ext_profile: true,
          tenant_domain: 'mydomain.com',
          waad_protocol: 'openid-connect'
        },
        strategy: 'waad'
      },
      {
        name: 'email',
        options: {
          email: {
            body: 'html code with test secret'
          }
        },
        strategy: 'email'
      },
      {
        name: 'someSamlConnection',
        strategy: 'samlp',
        enabled_clients: [ 'client1' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'idp-one',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      }
    ];


    const yamlFile = path.join(dir, 'connections.yaml');
    const connectionsPath = path.join(dir, 'connections');
    fs.writeFileSync(yamlFile, yaml);
    fs.ensureDirSync(connectionsPath);
    fs.writeFileSync(path.join(connectionsPath, 'email.html'), 'html code with ##secret##');

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { secret: 'test secret', name: 'test-waad', domain: 'mydomain.com' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.connections).to.deep.equal(target);
  });

  it('should dump connections', async () => {
    const dir = path.join(testDataDir, 'yaml', 'connectionsDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, './test.yml') }, mockMgmtClient());
    const connections = [
      { name: 'test-waad', strategy: 'waad', enabled_clients: [] },
      {
        name: 'email',
        strategy: 'email',
        enabled_clients: [],
        options: { email: { body: 'html code' } }
      },
      {
        name: 'someSamlConnection',
        strategy: 'samlp',
        enabled_clients: [ 'client1-id' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'client-idp-one-id',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      },
      {
        name: 'someSamlConnectionNoClientFound',
        strategy: 'samlp',
        enabled_clients: [ 'client2-id' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'client-idp-two-id',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      },
      {
        name: 'someSamlConnectionWithMultipleEnabledClients',
        strategy: 'samlp',
        enabled_clients: [ 'client3', 'client2', 'client1' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'client-idp-three-id',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      }
    ];

    const target = [
      { name: 'test-waad', strategy: 'waad', enabled_clients: [] },
      {
        name: 'email',
        strategy: 'email',
        enabled_clients: [],
        options: { email: { body: './email.html' } }
      },
      {
        name: 'someSamlConnection',
        strategy: 'samlp',
        enabled_clients: [ 'client1' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'client-idp-one-name',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      },
      {
        name: 'someSamlConnectionNoClientFound',
        strategy: 'samlp',
        enabled_clients: [ 'client2-id' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'client-idp-two-id',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      },
      {
        name: 'someSamlConnectionWithMultipleEnabledClients',
        strategy: 'samlp',
        enabled_clients: [ 'client1', 'client2', 'client3' ],
        options: {
          passwordPolicy: 'testPolicy',
          idpinitiated: {
            client_id: 'client-idp-three-id',
            client_protocol: 'samlp',
            client_authorizequery: ''
          }
        }
      }
    ];

    const clients = [
      { name: 'client-idp-one-name', app_type: 'spa', client_id: 'client-idp-one-id' },
      { name: 'client1', app_type: 'spa', client_id: 'client1-id' }
    ];

    context.assets.clients = clients;
    context.assets.connections = connections;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ connections: target });

    const templatesFolder = path.join(dir, 'connections');
    expect(fs.readFileSync(path.join(templatesFolder, 'email.html'), 'utf8')).to.deep.equal('html code');
  });
});
