import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';
import { cloneDeep } from 'lodash';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/flowVaultConnections';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context flowVaultConnections', () => {
  it('should process flowVaultConnections', async () => {
    const dir = path.join(testDataDir, 'yaml', 'flowVaultConnections');
    cleanThenMkdir(dir);

    const yaml = `
    flowVaultConnections:
      -
        name: 'Auth0 M2M Con #1'
        account_name: domain_name
        app_id: AUTH0
        ready: true
      -
        name: 'HTTP Con #1'
        app_id: HTTP
        ready: false
    `;

    const target = [
      { name: 'Auth0 M2M Con #1', account_name: 'domain_name', app_id: 'AUTH0', ready: true },
      { name: 'HTTP Con #1', app_id: 'HTTP', ready: false },
    ];

    const yamlFile = path.join(dir, 'flowVaultConnection.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.flowVaultConnections).to.deep.equal(target);
  });

  it('should dump flowVaultConnections', async () => {
    const dir = path.join(testDataDir, 'yaml', 'flowVaultConnections');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './flowVaultConnections.yml') },
      mockMgmtClient()
    );

    const flowVaultConnections = [
      { name: 'Auth0 M2M Con #1', account_name: 'domain_name', app_id: 'AUTH0', ready: true },
      { name: 'HTTP Con #1', app_id: 'HTTP', ready: false },
    ];

    context.assets.flowVaultConnections = cloneDeep(flowVaultConnections);

    const dumped = await handler.dump(context);

    expect(dumped).to.deep.equal({ flowVaultConnections });
  });
});
