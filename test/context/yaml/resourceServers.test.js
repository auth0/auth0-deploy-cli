import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/resourceServers';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context resource servers', () => {
  it('should process resource servers', async () => {
    const dir = path.join(testDataDir, 'yaml', 'resourceServers1');
    cleanThenMkdir(dir);

    const yaml = `
    resourceServers:
      -
        name: "##name##"
        identifier: @@identifier@@
        scopes:
          - name: "update:account"
            description: "update account"
          - name: "read:account"
            description: "read account"
          - name: "admin"
            description: "admin access"
    `;

    const target = [
      {
        identifier: 'http://myapi.com/api',
        name: 'my resource',
        scopes: [
          { description: 'update account', name: 'update:account' },
          { description: 'read account', name: 'read:account' },
          { description: 'admin access', name: 'admin' },
        ],
      },
    ];

    const yamlFile = path.join(dir, 'resources1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { name: 'my resource', identifier: 'http://myapi.com/api' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.resourceServers).to.deep.equal(target);
  });

  it('should dump resource servers', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const resourceServers = [
      {
        identifier: 'http://myapi.com/api',
        name: 'my resource',
        scopes: [
          { description: 'update account', name: 'update:account' },
          { description: 'read account', name: 'read:account' },
          { description: 'admin access', name: 'admin' },
        ],
      },
    ];
    context.assets.resourceServers = resourceServers;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ resourceServers });
  });

  it('should dump resource servers with client_id conversion', async () => {
    const mockClient = mockMgmtClient();
    mockClient.clients = {
      getAll: (params) => {
        const clients = [
          { client_id: 'client_123', name: 'Test Client' },
          { client_id: 'client_456', name: 'Another Client' },
        ];
        if (params && params.include_totals) {
          return { data: { clients, total: clients.length } };
        }
        return { data: clients };
      },
    };

    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockClient);

    const resourceServers = [
      {
        identifier: 'http://api.example.com',
        name: 'API with Client',
        client_id: 'client_123',
      },
      {
        identifier: 'http://api2.example.com',
        name: 'API without Client',
        // no client_id
      },
    ];
    context.assets.resourceServers = resourceServers;

    // Don't provide clients in assets to trigger API call
    context.assets.clients = undefined;

    const dumped = await handler.dump(context);

    expect(dumped.resourceServers).to.have.length(2);
    expect(dumped.resourceServers[0].client_id).to.equal('Test Client');
    expect(dumped.resourceServers[0].name).to.equal('API with Client');
    expect(dumped.resourceServers[1]).to.not.have.property('client_id');
    expect(dumped.resourceServers[1].name).to.equal('API without Client');
  });

  it('should dump resource servers with client_id when clients already in context', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());

    const resourceServers = [
      {
        identifier: 'http://api.example.com',
        name: 'API with Client',
        client_id: 'client_123',
      },
    ];
    context.assets.resourceServers = resourceServers;

    // Provide clients in assets so API call is not triggered
    context.assets.clients = [
      { client_id: 'client_123', name: 'Existing Test Client' },
      { client_id: 'client_456', name: 'Another Existing Client' },
    ];

    const dumped = await handler.dump(context);

    expect(dumped.resourceServers).to.have.length(1);
    expect(dumped.resourceServers[0].client_id).to.equal('Existing Test Client');
    expect(dumped.resourceServers[0].name).to.equal('API with Client');
    expect(dumped.resourceServers[0].identifier).to.equal('http://api.example.com');
  });
});
