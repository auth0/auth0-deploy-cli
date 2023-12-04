import path from 'path';
import fs from 'fs-extra';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/branding';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

const html = '<html>##foo##</html>';
const htmlTransformed = '<html>bar</html>';

describe('#YAML context branding templates', () => {
  it('should process branding settings, including templates', async () => {
    const dir = path.join(testDataDir, 'yaml', 'branding-process');
    cleanThenMkdir(dir);

    const htmlFile = path.join(dir, 'universalLogin.html');

    fs.writeFileSync(htmlFile, html);

    const yaml = `
    branding:
      colors:
        page_background: '#0f5a1b'
        primary: '#0f5a1b'
      logo_url: https://mycompany.org/logo-5.png
      templates:
        - template: universal_login
          body: universalLogin.html
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();
    expect(context.assets.branding).to.deep.equal({
      colors: {
        page_background: '#0f5a1b',
        primary: '#0f5a1b',
      },
      logo_url: 'https://mycompany.org/logo-5.png',
      templates: [
        {
          template: 'universal_login',
          body: htmlTransformed,
        },
      ],
    });
  });

  it('should dump branding settings, including templates', async () => {
    const dir = path.join(testDataDir, 'yaml', 'branding-dump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') },
      mockMgmtClient()
    );

    context.assets.branding = {
      colors: {
        page_background: '#0f5a1b',
        primary: '#0f5a1b',
      },
      logo_url: 'https://mycompany.org/logo-5.png',
      templates: [
        {
          template: 'universal_login',
          body: html,
        },
      ],
    };

    const dumped = await handler.dump(context);
    expect(dumped).to.deep.equal({
      branding: {
        colors: {
          page_background: '#0f5a1b',
          primary: '#0f5a1b',
        },
        logo_url: 'https://mycompany.org/logo-5.png',
        templates: [
          {
            template: 'universal_login',
            body: './branding_templates/universal_login.html',
          },
        ],
      },
    });

    const templatesFolder = path.join(dir, 'branding_templates');
    expect(
      fs.readFileSync(path.join(templatesFolder, 'universal_login.html'), 'utf8')
    ).to.deep.equal(html);
  });
});
