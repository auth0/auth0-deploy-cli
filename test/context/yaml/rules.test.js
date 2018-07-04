import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/yaml';
import { writeStringToFile, testDataDir, cleanThenMkdir } from 'test/utils';

describe('#context rules', () => {
  it('should process rules', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rules1');
    cleanThenMkdir(dir);

    const scriptContext = 'function someRule() { var hello = @@hello@@; }';
    const scriptFile = writeStringToFile(path.join(dir, 'script.js'), scriptContext);

    const yaml = `
    rules:
      rules:
        - name: "someRule"
          order: 10
          script: "${scriptFile}"
          enabled: false
    `;
    const yamlFile = writeStringToFile(path.join(dir, 'rule1.yaml'), yaml);

    const target = {
      someRule: {
        script: true,
        scriptFile: scriptContext,
        name: 'someRule',
        metadata: true,
        metadataFile: '{"name":"someRule","order":10,"stage":"login_success","enabled":false}'
      }
    };

    const context = new Context(yamlFile);
    await context.init();
    expect(context.rules).to.deep.equal(target);
  });

  it('should process rule settings', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rules2');
    cleanThenMkdir(dir);

    const yaml = `
    rules:
      settings:
        - key: "some"
          value: "secret"
    `;
    const yamlFile = writeStringToFile(path.join(dir, 'rule2.js'), yaml);

    const target = {
      some: {
        name: 'some',
        configFile: '{"key":"some","value":"secret"}'
      }
    };

    const context = new Context(yamlFile);
    await context.init();
    expect(context.ruleConfigs).to.deep.equal(target);
  });
});
