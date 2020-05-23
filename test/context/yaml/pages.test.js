import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/pages';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';


function createPagesDir(pagesDir, target) {
  cleanThenMkdir(pagesDir);
  Object.keys(target).forEach((scriptName) => {
    fs.writeFileSync(
      path.resolve(pagesDir, scriptName + '.html'),
      target[scriptName].html
    );
    if (target[scriptName].metadata) {
      fs.writeFileSync(
        path.resolve(pagesDir, scriptName + '.json'),
        target[scriptName].metadataFile
      );
    }
  });
}

describe('#YAML context pages', () => {
  it('should process pages', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pages1');
    cleanThenMkdir(dir);

    const htmlContext = '<html>this is a ##val1## @@val2@@</html>';
    const htmlFile = path.join(testDataDir, 'page.html');
    fs.writeFileSync(htmlFile, htmlContext);

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
    const yamlFile = path.join(dir, 'rule1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { val1: 'env1', val2: 'env2' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.pages).to.deep.equal(target);
  });

  it('should dump pages', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') }, mockMgmtClient());
    const htmlValidation = '<html>this is a env1 "env2"</html>';

    context.assets.pages = [
      { html: htmlValidation, name: 'login' },
      { html: htmlValidation, name: 'password_reset' },
      { enabled: false, html: htmlValidation, name: 'guardian_multifactor' },
      { html: htmlValidation, name: 'error_page' }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      pages: [
        { html: './pages/login.html', name: 'login' },
        { html: './pages/password_reset.html', name: 'password_reset' },
        { enabled: false, html: './pages/guardian_multifactor.html', name: 'guardian_multifactor' },
        { html: './pages/error_page.html', name: 'error_page' }
      ]
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.readFileSync(path.join(pagesFolder, 'login.html'), 'utf8')).to.deep.equal(htmlValidation);
    expect(fs.readFileSync(path.join(pagesFolder, 'password_reset.html'), 'utf8')).to.deep.equal(htmlValidation);
    expect(fs.readFileSync(path.join(pagesFolder, 'guardian_multifactor.html'), 'utf8')).to.deep.equal(htmlValidation);
    expect(fs.readFileSync(path.join(pagesFolder, 'error_page.html'), 'utf8')).to.deep.equal(htmlValidation);
  });
});
