import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/forms';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context forms', () => {
  it('should process forms', async () => {
    const dir = path.join(testDataDir, 'yaml', 'forms');
    cleanThenMkdir(dir);

    const yaml = `
    forms:
      -
        name: "Sample Form 1"
        body: ./forms/Sample Form 1.json
      -
        name: "Sample Form 2"
        body: ./forms/Sample Form 2.json
    `;

    const target = [{ name: 'Sample Form 1' }, { name: 'Sample Form 2' }];

    const yamlFile = path.join(dir, 'forms.yaml');
    const formsPath = path.join(dir, 'forms');
    fs.writeFileSync(yamlFile, yaml);
    fs.ensureDirSync(formsPath);
    fs.writeFileSync(path.join(formsPath, 'Sample Form 1.json'), '{"name": "Sample Form 1"}');
    fs.writeFileSync(path.join(formsPath, 'Sample Form 2.json'), '{"name": "Sample Form 2"}');

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.forms).to.deep.equal(target);
  });

  it('should dump forms', async () => {
    const dir = path.join(testDataDir, 'yaml', 'forms');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, './test.yml') },
      mockMgmtClient()
    );

    const forms = [{ name: 'Sample Form 1' }, { name: 'Sample Form 2' }];

    const target = [
      { name: 'Sample Form 1', body: './forms/Sample Form 1.json' },
      { name: 'Sample Form 2', body: './forms/Sample Form 2.json' },
    ];

    context.assets.forms = forms;

    const dumped = await handler.dump(context);
    const formsFolder = path.join(dir, 'forms');

    expect(dumped).to.deep.equal({ forms: target });
    expect(
      JSON.parse(fs.readFileSync(path.join(formsFolder, 'Sample Form 1.json'), 'utf8'))
    ).to.deep.equal({ name: 'Sample Form 1' });
    expect(
      JSON.parse(fs.readFileSync(path.join(formsFolder, 'Sample Form 2.json'), 'utf8'))
    ).to.deep.equal({ name: 'Sample Form 2' });
  });
});
