import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import Context from '../../../src/context/directory';
import handler from '../../../src/context/directory/handlers/branding';
import { constants } from '../../../src/tools';
import { loadJSON } from '../../../src/utils';
import {
  cleanThenMkdir, mockMgmtClient, testDataDir
} from '../../utils';

const html = '<html>##foo##</html>';
const htmlTransformed = '<html>bar</html>';

describe('#directory context branding', () => {
  it('should process templates', async () => {
    const dir = path.join(testDataDir, 'directory', 'branding-process');
    cleanThenMkdir(dir);
    const brandingDir = path.join(dir, constants.BRANDING_DIRECTORY, constants.BRANDING_TEMPLATES_DIRECTORY);
    cleanThenMkdir(brandingDir);
    const markupFile = path.join(brandingDir, 'universal_login.html');
    fs.writeFileSync(markupFile, html);
    fs.writeFileSync(path.join(brandingDir, 'universal_login.json'), JSON.stringify({ template: 'universal_login', body: `.${path.sep}universal_login.html` }));

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.branding).to.be.an('object');
    expect(context.assets.branding.templates).to.deep.equal([
      {
        template: 'universal_login',
        body: htmlTransformed
      }
    ]);
  });

  it('should dump templates', async () => {
    const repoDir = path.join(testDataDir, 'directory', 'branding-dump');
    cleanThenMkdir(repoDir);
    const context = new Context({ AUTH0_INPUT_FILE: repoDir }, mockMgmtClient());

    context.assets.branding = {
      templates: [
        {
          body: html,
          template: 'universal_login'
        }
      ]
    };

    await handler.dump(context);

    const brandingDir = path.join(repoDir, constants.BRANDING_DIRECTORY, constants.BRANDING_TEMPLATES_DIRECTORY);
    const markup = fs.readFileSync(path.join(brandingDir, 'universal_login.html')).toString();
    expect(markup).to.equal(html);
    const templateDefinition = loadJSON(path.join(brandingDir, 'universal_login.json'));
    expect(templateDefinition).to.deep.equal({
      template: 'universal_login',
      body: `.${path.sep}universal_login.html`
    });
  });
});
