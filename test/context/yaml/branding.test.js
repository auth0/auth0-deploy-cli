import fs from 'fs-extra';
import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/branding';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

const html = '<html>##foo##</html>';
const htmlTransformed = '<html>bar</html>';

describe('#YAML context branding templates', () => {
  it('should process branding templates', async () => {
    const dir = path.join(testDataDir, 'yaml', 'branding-process');
    cleanThenMkdir(dir);

    const htmlFile = path.join(dir, 'universalLogin.html');
    fs.writeFileSync(htmlFile, html);

    const yaml = `
    branding:
      templates:
        - template: universal_login
          body: ${htmlFile}
    `;
    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
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

  it('should dump branding templates', async () => {
    const dir = path.join(testDataDir, 'yaml', 'branding-dump');
    cleanThenMkdir(dir);
    const context = new Context(
      { AUTH0_INPUT_FILE: path.join(dir, 'tenant.yaml') },
      mockMgmtClient()
    );

    context.assets.branding = {
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
