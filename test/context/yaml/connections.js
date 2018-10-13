import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context YAML connections', () => {
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
          waad_protocol: 'openid-connect'
          api_enable_users: true
          basic_profile: true
          ext_profile: true
          ext_groups: true
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
      }
    ];

    const yamlFile = writeStringToFile(path.join(dir, 'connections.yaml'), yaml);
    const context = new Context(yamlFile, { name: 'test-waad', domain: 'mydomain.com' }, null, mockMgmtClient());
    await context.load();

    expect(context.assets.connections).to.deep.equal(target);
  });
});
