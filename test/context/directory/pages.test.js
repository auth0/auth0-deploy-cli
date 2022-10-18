import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';
import { constants } from '../../../src/tools';

import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/pages';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, testDataDir, createDir, mockMgmtClient } from '../../utils';

const pages = {
  'login.json': '{ "name": "login", "enabled": true }',
  'login.html': '<html>this is a page env ##env##</html>',
  'guardian_multifactor.json': '{ "name": "guardian_multifactor", "enabled": true }',
  'guardian_multifactor.html': '<html>this is a page env ##env##</html>',
  'password_reset.json': '{ "name": "password_reset", "enabled": true }',
  'password_reset.html': '<html>this is a page env ##env##</html>',
  'error_page.json':
    '{ "name": "error_page", "url": "https://example.com/error", "show_log_link": false }',
  'error_page.html': '<html>this is a page env ##env##</html>',
};

const pagesTarget = [
  {
    html: '<html>this is a page env test</html>',
    name: 'error_page',
    url: 'https://example.com/error',
    show_log_link: false,
  },
  { enabled: true, html: '<html>this is a page env test</html>', name: 'guardian_multifactor' },
  { enabled: true, html: '<html>this is a page env test</html>', name: 'login' },
  { enabled: true, html: '<html>this is a page env test</html>', name: 'password_reset' },
];

describe('#directory context pages', () => {
  it('should process pages', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'pages1');
    createDir(repoDir, { [constants.PAGES_DIRECTORY]: pages });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.pages).to.deep.equal(pagesTarget);
  });

  it('should process login and error pages without HTML files', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'pages4');

    const pagesNoHtml = {
      'login.json': '{ "name": "login", "enabled": false }',
      'error_page.json':
        '{ "name": "error_page", "url": "https://example.com/error", "show_log_link": false }',
    };

    createDir(repoDir, { [constants.PAGES_DIRECTORY]: pagesNoHtml });

    const config = { AUTH0_INPUT_FILE: repoDir };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.pages).to.deep.equal([
      {
        html: '',
        name: 'error_page',
        show_log_link: false,
        url: 'https://example.com/error',
      },
      {
        html: '',
        name: 'login',
        enabled: false,
      },
    ]);
  });

  it('should ignore unknown file', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'pages2');
    const invalidFile = {
      ...pages,
      'README.md': 'something',
    };
    createDir(repoDir, { [constants.PAGES_DIRECTORY]: invalidFile });

    const config = { AUTH0_INPUT_FILE: repoDir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { env: 'test' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.pages).to.deep.equal(pagesTarget);
  });

  it('should ignore bad pages directory', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'pages3');
    cleanThenMkdir(repoDir);
    const dir = path.join(repoDir, constants.PAGES_DIRECTORY);
    fs.writeFileSync(dir, 'junk');

    const context = new Context({ AUTH0_INPUT_FILE: repoDir });
    const errorMessage = `Expected ${dir} to be a folder but got a file?`;
    await expect(context.load())
      .to.be.eventually.rejectedWith(Error)
      .and.have.property('message', errorMessage);
  });

  it('should dump pages', async () => {
    const dir = path.join(testDataDir, 'directory', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const errorPageUrl = 'https://example.com/error';

    const htmlValidation = '<html>this is a env1 "env2"</html>';

    context.assets.pages = [
      { html: htmlValidation, name: 'login' },
      { enabled: false, html: htmlValidation, name: 'password_reset' },
      { name: 'guardian_multifactor' }, //No `html` property defined
      {
        name: 'error_page',
        url: errorPageUrl, // URL defined instead of `html` property
        show_log_link: false,
      },
    ];

    await handler.dump(context);

    const pagesFolder = path.join(dir, constants.PAGES_DIRECTORY);

    expect(loadJSON(path.join(pagesFolder, 'login.json'))).to.deep.equal({
      html: './login.html',
      name: 'login',
    });
    expect(fs.readFileSync(path.join(pagesFolder, 'login.html'), 'utf8')).to.deep.equal(
      htmlValidation
    );

    expect(loadJSON(path.join(pagesFolder, 'password_reset.json'))).to.deep.equal({
      html: './password_reset.html',
      name: 'password_reset',
      enabled: false,
    });
    expect(fs.readFileSync(path.join(pagesFolder, 'password_reset.html'), 'utf8')).to.deep.equal(
      htmlValidation
    );

    expect(loadJSON(path.join(pagesFolder, 'guardian_multifactor.json'))).to.deep.equal({
      name: 'guardian_multifactor',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(fs.existsSync(path.join(pagesFolder, 'guardian_multifactor.html'), 'utf8')).to.be.false; // Should not dump template with no HTML

    expect(loadJSON(path.join(pagesFolder, 'error_page.json'))).to.deep.equal({
      name: 'error_page',
      url: errorPageUrl,
      show_log_link: false,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(fs.existsSync(path.join(pagesFolder, 'error_page.html'), 'utf8')).to.be.false; // Should not dump template with no HTML
  });

  it('should dump empty error page even if HTML is not set', async () => {
    const dir = path.join(testDataDir, 'directory', 'pagesDump');
    cleanThenMkdir(dir);
    const context = new Context({ AUTH0_INPUT_FILE: dir }, mockMgmtClient());
    const errorPageUrl = 'https://example.com/error';

    context.assets.pages = [
      {
        name: 'error_page',
        url: errorPageUrl,
        show_log_link: false,
        html: '',
      },
    ];

    await handler.dump(context);

    const pagesFolder = path.join(dir, constants.PAGES_DIRECTORY);
    expect(loadJSON(path.join(pagesFolder, 'error_page.json'))).to.deep.equal({
      name: 'error_page',
      url: errorPageUrl,
      show_log_link: false,
      html: './error_page.html',
    });
    expect(fs.existsSync(path.join(pagesFolder, 'error_page.html'))).to.equal(true);
  });
});
