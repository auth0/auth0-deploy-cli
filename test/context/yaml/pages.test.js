import path from 'path';
import { expect } from 'chai';

import Context from 'src/context/yaml';
import { cleanThenMkdir, testDataDir, writeStringToFile } from 'test/utils';

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
      login:
        html: "${htmlFile}"
      guardian_multifactor:
        enabled: false
        html: "${htmlFile}"
      password_reset:
        enabled: true
        html: "${htmlFile}"
      error_page:
        enabled: true
        html: "${htmlFile}"
    `;

    const target = {
      login: {
        htmlFile: htmlContext,
        name: 'login',
        metadata: true,
        metadataFile: '{"enabled":true}'
      },
      guardian_multifactor: {
        htmlFile: htmlContext,
        metadata: true,
        metadataFile: '{"enabled":false}',
        name: 'guardian_multifactor'
      },
      password_reset: {
        htmlFile: htmlContext,
        metadata: true,
        metadataFile: '{"enabled":true}',
        name: 'password_reset'
      },
      error_page: {
        htmlFile: htmlContext,
        metadata: true,
        metadataFile: '{"enabled":true}',
        name: 'error_page'
      }
    };
    createPagesDir(dir, target);
    const yamlFile = writeStringToFile(path.join(dir, 'rule1.yaml'), yaml);

    const context = new Context(yamlFile, { val1: 'env1', val2: 'env2' });
    await context.init();

    const htmlValidation = '<html>this is a env1 "env2"</html>';
    target.login.htmlFile = htmlValidation;
    target.guardian_multifactor.htmlFile = htmlValidation;
    target.password_reset.htmlFile = htmlValidation;
    target.error_page.htmlFile = htmlValidation;
    expect(context.pages).to.deep.equal(target);
  });
});
