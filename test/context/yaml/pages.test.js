import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/pages';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

function createPagesDir(pagesDir, target) {
  cleanThenMkdir(pagesDir);
  Object.keys(target).forEach((scriptName) => {
    fs.writeFileSync(path.resolve(pagesDir, scriptName + '.html'), target[scriptName].html);
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

    const errorPageUrl = 'https://example.com';
    const yaml = `
    pages:
      - name: "login"
        html: "page.html"

      - name: "password_reset"
        html: "page.html"

      - name: "guardian_multifactor"
        html: "page.html"
        enabled: false

      - name: "error_page"
        html: "page.html"
        url: "${errorPageUrl}"
        show_log_link: false
    `;

    const htmlValidation = '<html>this is a env1 "env2"</html>';
    const target = [
      {
        html: htmlValidation,
        name: 'login',
      },
      {
        html: htmlValidation,
        name: 'password_reset',
      },
      {
        enabled: false,
        html: htmlValidation,
        name: 'guardian_multifactor',
      },
      {
        html: htmlValidation,
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false,
      },
    ];
    createPagesDir(dir, target);
    // Write page.html after createPagesDir since createPagesDir calls cleanThenMkdir(dir)
    fs.writeFileSync(path.join(dir, 'page.html'), htmlContext);
    const yamlFile = path.join(dir, 'rule1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = {
      AUTH0_INPUT_FILE: yamlFile,
      AUTH0_KEYWORD_REPLACE_MAPPINGS: { val1: 'env1', val2: 'env2' },
    };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.pages).to.deep.equal(target);
  });

  it('should reject page html with a path outside the config directory', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pages-path-traversal');
    cleanThenMkdir(dir);

    const yaml = `
    pages:
      - name: "login"
        html: "/absolute/path/outside/config/login.html"
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const context = new Context({ AUTH0_INPUT_FILE: yamlFile }, mockMgmtClient());
    await expect(context.loadAssetsFromLocal()).to.be.eventually.rejectedWith(
      Error,
      'must be relative to the config directory'
    );
  });

  it('should accept page html with a path relative to the config directory', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pages-relative-path');
    cleanThenMkdir(dir);

    const htmlContent = '<html>login page</html>';
    const yaml = `
    pages:
      - name: "login"
        html: "page.html"
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);
    fs.writeFileSync(path.join(dir, 'page.html'), htmlContent);

    const context = new Context({ AUTH0_INPUT_FILE: yamlFile }, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.pages[0].html).to.equal(htmlContent);
  });

  it('should dump pages', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') },
      mockMgmtClient()
    );
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
        show_log_link: false,
      },
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
          show_log_link: false,
        },
      ],
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.readFileSync(path.join(pagesFolder, 'login.html'), 'utf8')).to.deep.equal(
      htmlValidation
    );
    expect(fs.readFileSync(path.join(pagesFolder, 'password_reset.html'), 'utf8')).to.deep.equal(
      htmlValidation
    );
    expect(
      fs.readFileSync(path.join(pagesFolder, 'guardian_multifactor.html'), 'utf8')
    ).to.deep.equal(htmlValidation);
    expect(fs.readFileSync(path.join(pagesFolder, 'error_page.html'), 'utf8')).to.deep.equal(
      htmlValidation
    );
  });

  it('should not throw if page HTML is not defined', async () => {
    // See: https://github.com/auth0/auth0-deploy-cli/issues/365
    const dir = path.join(testDataDir, 'yaml', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') },
      mockMgmtClient()
    );

    context.assets.pages = [
      { name: 'login' }, // HTML property is not defined here
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      pages: [
        {
          name: 'login',
        },
      ],
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.readdirSync(pagesFolder).length).to.equal(0);
  });

  it('should dump error_page with html undefined', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') },
      mockMgmtClient()
    );
    const errorPageUrl = 'https://example.com';

    context.assets.pages = [
      {
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false,
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      pages: [
        {
          name: 'error_page',
          url: errorPageUrl,
          show_log_link: false,
        },
      ],
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.existsSync(path.join(pagesFolder, 'error_page.html'))).to.equal(false);
  });

  it('should dump error_page with empty html', async () => {
    const dir = path.join(testDataDir, 'yaml', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tennat.yaml') },
      mockMgmtClient()
    );
    const htmlValidation = '';
    const errorPageUrl = 'https://example.com';

    context.assets.pages = [
      {
        html: htmlValidation,
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false,
      },
    ];

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      pages: [
        {
          html: './pages/error_page.html',
          name: 'error_page',
          url: errorPageUrl,
          show_log_link: false,
        },
      ],
    });

    const pagesFolder = path.join(dir, 'pages');
    expect(fs.readFileSync(path.join(pagesFolder, 'error_page.html'), 'utf8')).to.deep.equal(
      htmlValidation
    );
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
        html: '',
      },
    ];
    createPagesDir(dir, target);
    const yamlFile = path.join(dir, 'rule1.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.pages).to.deep.equal(target);
  });
});
