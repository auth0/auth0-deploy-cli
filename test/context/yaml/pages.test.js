import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import {
  cleanThenMkdir, testDataDir, writeStringToFile, mockMgmtClient
} from '../../utils';


function createPagesDir(pagesDir, target) {
  cleanThenMkdir(pagesDir);
  Object.keys(target).forEach((scriptName) => {
    writeStringToFile(
      path.resolve(pagesDir, scriptName + '.html'),
      target[scriptName].htmlFile
    );
    if (target[scriptName].metadata) {
      writeStringToFile(
        path.resolve(pagesDir, scriptName + '.json'),
        target[scriptName].metadataFile
      );
    }
  });
}

describe('#context YAML pages', () => {
  it('should process pages', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pages1');
    cleanThenMkdir(dir);

    const htmlContext = '<html>this is a ##val1## @@val2@@</html>';
    const htmlFile = writeStringToFile(path.join(testDataDir, 'page.html'), htmlContext);

    const yaml = `
    pages:
      - name: "login"
        html: "${htmlFile}"
    
      - name: "password_reset"
        html: "${htmlFile}"
    
      - name: "guardian_multifactor"
        html: "${htmlFile}"
        enabled: false
    
      - name: "error_page"
        html: "${htmlFile}"
    `;

    const htmlValidation = '<html>this is a env1 "env2"</html>';
    const target = [
      {
        html: htmlValidation,
        name: 'login'
      },
      {
        html: htmlValidation,
        name: 'password_reset'
      },
      {
        enabled: false,
        html: htmlValidation,
        name: 'guardian_multifactor'
      },
      {
        html: htmlValidation,
        name: 'error_page'
      }
    ];
    createPagesDir(dir, target);
    const yamlFile = writeStringToFile(path.join(dir, 'rule1.yaml'), yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { val1: 'env1', val2: 'env2' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.pages).to.deep.equal(target);
  });
});
