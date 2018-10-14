import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


describe('#context rules', () => {
  it('should process rules', async () => {
    const dir = path.join(testDataDir, 'yaml', 'rules1');
    cleanThenMkdir(dir);

    const scriptContext = 'function someRule() { var hello = @@hello@@; }';
    const scriptFile = writeStringToFile(path.join(dir, 'script.js'), scriptContext);

    const yaml = `
    rules:
      - name: "someRule"
        order: 10
        script: "${scriptFile}"
        enabled: false
    `;
    const yamlFile = writeStringToFile(path.join(dir, 'rule1.yaml'), yaml);

    const target = [
      {
        enabled: false,
        name: 'someRule',
        order: 10,
        script: 'function someRule() { var hello = "test"; }',
        stage: 'login_success'
      }
    ];

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { hello: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.rules).to.deep.equal(target);
  });
});
