import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/branding';
import { constants } from '../../../src/tools';
import { loadJSON } from '../../../src/utils';
import { cleanThenMkdir, mockMgmtClient, testDataDir } from '../../utils';

const brandingString = `{
  "colors": {
    "primary": "#ffffff",
    "page_background": "#000000"
  },
  "logo_url": "https://example.net/logo.svg"
}`;
const brandingTarget = {
  colors: {
    primary: '#ffffff',
    page_background: '#000000',
  },
  logo_url: 'https://example.net/logo.svg',
};

const html = '<html>##foo##</html>';
const htmlTransformed = '<html>bar</html>';

describe('#directory context branding', () => {
  it('should process', async () => {
    const dir = path.join(testDataDir, 'directory', 'branding-process');
    cleanThenMkdir(dir);
    const brandingDir = path.join(dir, constants.BRANDING_DIRECTORY);
    cleanThenMkdir(brandingDir);
    const brandingTemplatesDir = path.join(brandingDir, constants.BRANDING_TEMPLATES_DIRECTORY);
    cleanThenMkdir(brandingTemplatesDir);
    const brandingFile = path.join(brandingDir, 'branding.json');
    fs.writeFileSync(brandingFile, brandingString);
    const markupFile = path.join(brandingTemplatesDir, 'universal_login.html');
    fs.writeFileSync(markupFile, html);
    fs.writeFileSync(
      path.join(brandingTemplatesDir, 'universal_login.json'),
      JSON.stringify({ template: 'universal_login', body: `.${path.sep}universal_login.html` })
    );

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.branding.logo_url).to.deep.equal(brandingTarget.logo_url);
    expect(context.assets.branding.colors).to.deep.equal(brandingTarget.colors);
    expect(context.assets.branding.templates).to.deep.equal([
      {
        template: 'universal_login',
        body: htmlTransformed,
      },
    ]);
  });

  it('should dump', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'branding-dump');
    cleanThenMkdir(repoDir);
    const context = new Context({ AUTH0_INPUT_FILE: repoDir }, mockMgmtClient());

    context.assets.branding = {
      colors: brandingTarget.colors,
      logo_url: brandingTarget.logo_url,
      templates: [
        {
          body: html,
          template: 'universal_login',
        },
      ],
    };

    await handler.dump(context);

    const brandingDir = path.join(repoDir, constants.BRANDING_DIRECTORY);
    const branding = fs.readFileSync(path.join(brandingDir, 'branding.json')).toString();
    expect(branding).to.equal(brandingString);

    const brandingTemplatesDir = path.join(brandingDir, constants.BRANDING_TEMPLATES_DIRECTORY);
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
