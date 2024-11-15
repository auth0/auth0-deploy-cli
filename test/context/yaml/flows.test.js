import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/flows';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context flows', () => {
  it('should process flows', async () => {
    const dir = path.join(testDataDir, 'yaml', 'flows');
    cleanThenMkdir(dir);

    const yaml = `
    flows:
      -
        name: "Sample Flow 1"
        body: ./flows/Sample Flow 1.json
      -
        name: "Sample Flow 2"
        body: ./flows/Sample Flow 2.json
    `;

    const target = [{ name: 'Sample Flow 1' }, { name: 'Sample Flow 2' }];

    const yamlFile = path.join(dir, 'flows.yaml');
    const flowsPath = path.join(dir, 'flows');
    fs.writeFileSync(yamlFile, yaml);
    fs.ensureDirSync(flowsPath);
    fs.writeFileSync(path.join(flowsPath, 'Sample Flow 1.json'), '{"name": "Sample Flow 1"}');
    fs.writeFileSync(path.join(flowsPath, 'Sample Flow 2.json'), '{"name": "Sample Flow 2"}');

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.flows).to.deep.equal(target);
  });

  it('should dump flows', async () => {
    const dir = path.join(testDataDir, 'yaml', 'flows');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './test.yml') },
      mockMgmtClient()
    );

    const flows = [{ name: 'Sample Flow 1' }, { name: 'Sample Flow 2' }];

    const target = [
      { name: 'Sample Flow 1', body: './flows/Sample Flow 1.json' },
      { name: 'Sample Flow 2', body: './flows/Sample Flow 2.json' },
    ];

    context.assets.flows = flows;

    const dumped = await handler.dump(context);
    const flowsFolder = path.join(dir, 'flows');

    expect(dumped).to.deep.equal({ flows: target });
    expect(
      JSON.parse(fs.readFileSync(path.join(flowsFolder, 'Sample Flow 1.json'), 'utf8'))
    ).to.deep.equal({ name: 'Sample Flow 1' });
    expect(
      JSON.parse(fs.readFileSync(path.join(flowsFolder, 'Sample Flow 2.json'), 'utf8'))
    ).to.deep.equal({ name: 'Sample Flow 2' });
  });
});
