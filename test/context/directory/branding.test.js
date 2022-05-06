import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/branding';
import { constants } from '../../../src/tools';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, mockMgmtClient, testDataDir } from '../../utils';

const html = '<html>##foo##</html>';
const htmlTransformed = '<html>bar</html>';

const brandingSettings = JSON.stringify({
  colors: {
    primary: '#FFFFFF',
    page_background: '#000000',
  },
  font: {
    url: 'https://mycompany.org/font/myfont.ttf',
  },
});

describe('#directory context branding', () => {
  it('should process branding settings, including templates', async () => {
    const dir = path.join(testDataDir, 'directory', 'branding-process');
    cleanThenMkdir(dir);
    const brandingDir = path.join(dir, constants.BRANDING_DIRECTORY);
    cleanThenMkdir(brandingDir);
    const brandingTemplatesDir = path.join(brandingDir, constants.BRANDING_TEMPLATES_DIRECTORY);
    cleanThenMkdir(brandingTemplatesDir);

    fs.writeFileSync(path.join(brandingDir, 'branding.json'), brandingSettings);

    fs.writeFileSync(path.join(brandingTemplatesDir, 'universal_login.html'), html);
    fs.writeFileSync(
      path.join(brandingTemplatesDir, 'universal_login.json'),
      JSON.stringify({ template: 'universal_login', body: `.${path.sep}universal_login.html` })
    );

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.branding).to.be.an('object');
    expect(context.assets.branding.templates).to.deep.equal([
      {
        template: 'universal_login',
        body: htmlTransformed,
      },
    ]);
  });

  it('should process only templates, not branding settings', async () => {
    const dir = path.join(testDataDir, 'directory', 'branding-process');
    cleanThenMkdir(dir);
    const brandingDir = path.join(dir, constants.BRANDING_DIRECTORY);
    cleanThenMkdir(brandingDir);
    const brandingTemplatesDir = path.join(brandingDir, constants.BRANDING_TEMPLATES_DIRECTORY);
    cleanThenMkdir(brandingTemplatesDir);

    fs.writeFileSync(path.join(brandingTemplatesDir, 'universal_login.html'), html);
    fs.writeFileSync(
      path.join(brandingTemplatesDir, 'universal_login.json'),
      JSON.stringify({ template: 'universal_login', body: `.${path.sep}universal_login.html` })
    );

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.branding).to.be.an('object');
    expect(context.assets.branding).to.deep.equal({
      templates: [
        {
          template: 'universal_login',
          body: htmlTransformed,
        },
      ],
    });
  });

  it('should process only branding settings, not templates', async () => {
    const dir = path.join(testDataDir, 'directory', 'branding-process');
    cleanThenMkdir(dir);
    const brandingDir = path.join(dir, constants.BRANDING_DIRECTORY);
    cleanThenMkdir(brandingDir);

    fs.writeFileSync(path.join(brandingDir, 'branding.json'), brandingSettings);

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.branding).to.be.an('object');
    expect(context.assets.branding).to.not.have.property('templates');
  });

  it('should dump branding settings, including templates', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'branding-dump');
    cleanThenMkdir(repoDir);
    const context = new Context({ AUTH0_INPUT_FILE: repoDir }, mockMgmtClient());

    context.assets.branding = {
      colors: {
        primary: '#F8F8F2',
        page_background: '#112',
      },
      font: {
        url: 'https://mycompany.org/font/myfont.ttf',
      },
      templates: [
        {
          body: html,
          template: 'universal_login',
        },
      ],
    };

    await handler.dump(context);

    const brandingDir = path.join(repoDir, constants.BRANDING_DIRECTORY);
    const brandingTemplatesDir = path.join(brandingDir, constants.BRANDING_TEMPLATES_DIRECTORY);

    const brandingSettingsFile = fs
      .readFileSync(path.join(brandingDir, 'branding.json'))
      .toString();

    expect(JSON.parse(brandingSettingsFile)).to.deep.equal({
      colors: {
        primary: '#F8F8F2',
        page_background: '#112',
      },
      font: {
        url: 'https://mycompany.org/font/myfont.ttf',
      },
    });

    const markup = fs
      .readFileSync(path.join(brandingTemplatesDir, 'universal_login.html'))
      .toString();

    expect(markup).to.equal(html);
    const templateDefinition = loadJSON(path.join(brandingTemplatesDir, 'universal_login.json'));
    expect(templateDefinition).to.deep.equal({
      template: 'universal_login',
      body: `.${path.sep}universal_login.html`,
    });
  });
});
