import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/rules';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

describe('#YAML context rules', () => {
  it('should process rules', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rules1');
    cleanThenMkdir(dir);

    const scriptContext = 'function someRule() { var hello = @@hello@@; }';
    const scriptFile = path.join(dir, 'script.js');
    fs.writeFileSync(scriptFile, scriptContext);

    const yaml = `
    rules:
      - name: "someRule"
        order: 10
        script: "${scriptFile}"
        enabled: false
    `;
    const yamlFile = path.join(dir, 'rule1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const target = [
      {
        enabled: false,
        name: 'someRule',
        order: 10,
        script: 'function someRule() { var hello = "test"; }',
        stage: 'login_success',
      },
    ];

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { hello: 'test' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.rules).to.deep.equal(target);
  });

  it('should dump rules', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rulesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') },
      mockMgmtClient()
    );
    const scriptValidation = 'function someRule() { var hello = "test"; }';

    context.assets.rules = [
      {
        enabled: false,
        name: 'someRule',
        order: 10,
        script: scriptValidation,
        stage: 'login_success',
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      rules: [
        {
          enabled: false,
          name: 'someRule',
          order: 10,
          script: './rules/someRule.js',
          stage: 'login_success',
        },
      ],
    });

    const rulesFolder = path.join(dir, 'rules');
    expect(fs.readFileSync(path.join(rulesFolder, 'someRule.js'), 'utf8')).to.deep.equal(
      scriptValidation
    );
  });

  it('should dump rules sanitized', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rulesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') },
      mockMgmtClient()
    );
    const scriptValidation = 'function someRule() { var hello = "test"; }';

    context.assets.rules = [
      {
        enabled: false,
        name: 'someRule / test',
        order: 10,
        script: scriptValidation,
        stage: 'login_success',
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      rules: [
        {
          enabled: false,
          name: 'someRule / test',
          order: 10,
          script: './rules/someRule - test.js',
          stage: 'login_success',
        },
      ],
    });

    const rulesFolder = path.join(dir, 'rules');
    expect(fs.readFileSync(path.join(rulesFolder, 'someRule - test.js'), 'utf8')).to.deep.equal(
      scriptValidation
    );
  });
});
