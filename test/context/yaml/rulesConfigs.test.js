import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/rulesConfigs';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context rules configs', () => {
  it('should process rules configs', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rulesConfigs');
    cleanThenMkdir(dir);

    const yaml = `
    rulesConfigs:
      - key: "SOME_SECRET"
        value: 'some_key'
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [{ key: 'SOME_SECRET', value: 'some_key' }];

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.rulesConfigs).to.deep.equal(target);
  });

  it('should dump rules configs', async () => {
    const context = new Context({ AUTH0_INPUT_FILE: './test.yml' }, mockMgmtClient());
    const rulesConfigs = [{ key: 'SOME_SECRET', value: 'some_key' }];
    context.assets.rulesConfigs = rulesConfigs;

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({ rulesConfigs: [] });
  });
});
