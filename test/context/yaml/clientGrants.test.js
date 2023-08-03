import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/clientGrants';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context client grants', () => {
  it('should process client grants', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientGrants');
    cleanThenMkdir(dir);

    const yaml = `
    clientGrants:
      - client_id: "my_client_id"
        name: "My M2M"
        audience: "https://##ENV##.myapp.com/api/v1"
        scope:
          - "update:account"
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        audience: 'https://test.myapp.com/api/v1',
        client_id: 'my_client_id',
        name: 'My M2M',
        scope: ['update:account'],
      },
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.clientGrants).to.deep.equal(target);
  });

  it('should dump client grants', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const clientGrants = [
      { audience: 'https://test.myapp.com/api/v1', client_id: 'My M2M', scope: ['update:account'] },
    ];
    context.assets.clientGrants = clientGrants;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ clientGrants });
  });
});
