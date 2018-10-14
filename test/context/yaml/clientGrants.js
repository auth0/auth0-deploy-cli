import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context client grants', () => {
  it('should process rules configs', async () => {
    const dir = path.join(testDataDir, 'yaml', 'clientGrants');
    cleanThenMkdir(dir);

    const yaml = `
    clientGrants:
      - client_id: "My M2M"
        audience: "https://##ENV##.myapp.com/api/v1"
        scope:
          - "update:account"
    `;
    const yamlFile = writeStringToFile(path.join(dir, 'config.yaml'), yaml);

    const target = [
      {
        audience: 'https://test.myapp.com/api/v1',
        client_id: 'My M2M',
        scope: [
          'update:account'
        ]
      }
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { ENV: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();
    expect(context.assets.clientGrants).to.deep.equal(target);
  });
});
