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

    const errorPageUrl = 'https://example.com';
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
        url: "${errorPageUrl}"
        show_log_link: false
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
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false
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
    const errorPageUrl = 'https://example.com';

    context.assets.pages = [
      { html: htmlValidation, name: 'login' },
      { html: htmlValidation, name: 'password_reset' },
      { enabled: false, html: htmlValidation, name: 'guardian_multifactor' },
      {
        html: htmlValidation,
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      pages: [
        { html: './pages/login.html', name: 'login' },
        { html: './pages/password_reset.html', name: 'password_reset' },
        { enabled: false, html: './pages/guardian_multifactor.html', name: 'guardian_multifactor' },
        {
          html: './pages/error_page.html',
          name: 'error_page',
          url: errorPageUrl,
          show_log_link: false
        }
      ]
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.readFileSync(path.join(pagesFolder, 'login.html'), 'utf8')).to.deep.equal(htmlValidation);
    expect(fs.readFileSync(path.join(pagesFolder, 'password_reset.html'), 'utf8')).to.deep.equal(htmlValidation);
    expect(fs.readFileSync(path.join(pagesFolder, 'guardian_multifactor.html'), 'utf8')).to.deep.equal(htmlValidation);
    expect(fs.readFileSync(path.join(pagesFolder, 'error_page.html'), 'utf8')).to.deep.equal(htmlValidation);
  });

  it('should dump error_page with html undefined', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') }, mockMgmtClient());
    const errorPageUrl = 'https://example.com';

    context.assets.pages = [
      {
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      pages: [
        {
          name: 'error_page',
          url: errorPageUrl,
          show_log_link: false
        }
      ]
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.existsSync(path.join(pagesFolder, 'error_page.html'))).to.equal(false);
  });

  it('should dump error_page with empty html', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') }, mockMgmtClient());
    const htmlValidation = '';
    const errorPageUrl = 'https://example.com';

    context.assets.pages = [
      {
        html: htmlValidation,
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false
      }
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      pages: [
        {
          html: './pages/error_page.html',
          name: 'error_page',
          url: errorPageUrl,
          show_log_link: false
        }
      ]
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.readFileSync(path.join(pagesFolder, 'error_page.html'), 'utf8')).to.deep.equal(htmlValidation);
  });

  it('should process error_pages without html field', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pages1');
    cleanThenMkdir(dir);

    const errorPageUrl = 'https://example.com';
    const yaml = `
    pages:
      - name: "error_page"
        url: "${errorPageUrl}"
    `;
    const target = [
      {
        name: 'error_page',
        url: errorPageUrl,
        html: ''
      }
    ];
    createPagesDir(dir, target);
    const yamlFile = path.join(dir, 'rule1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.pages).to.deep.equal(target);
  });
});
