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
      { name: 'test-waad', strategy: 'waad' },
      {
        name: 'email',
        strategy: 'email',
        options: { email: { body: 'html code' } }
      }
    ];

    const target = [
      { name: 'test-waad', strategy: 'waad' },
      {
        name: 'email',
        strategy: 'email',
        options: { email: { body: './email.html' } }
      }
    ];

    context.assets.connections = connections;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ connections: target });

    const templatesFolder = path.join(dir, 'connections');
    expect(fs.readFileSync(path.join(templatesFolder, 'email.html'), 'utf8')).to.deep.equal('html code');
  });
});
