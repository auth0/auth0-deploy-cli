import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/yaml';
import { writeStringToFile, testDataDir, cleanThenMkdir } from 'test/utils';


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

    const target = {
      'test-waad': {
        configFile: '{"name":"test-waad","strategy":"waad","options":{"tenant_domain":"mydomain.com","client_id":"my_client_id","client_secret":"my_secret","domain":"somedomain.com","waad_protocol":"openid-connect","api_enable_users":true,"basic_profile":true,"ext_profile":true,"ext_groups":true}}',
        name: 'test-waad'
      }
    };

    const yamlFile = writeStringToFile(path.join(dir, 'connections.yaml'), yaml);
    const context = new Context(yamlFile, { name: 'test-waad', domain: 'mydomain.com' });
    await context.init();

    expect(context.connections).to.deep.equal(target);
  });
});

