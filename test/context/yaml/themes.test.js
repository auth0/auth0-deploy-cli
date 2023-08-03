import path from 'path';
import { dump as toYaml } from 'js-yaml';
import fs from 'fs-extra';
import { expect } from 'chai';
import { cleanThenMkdir, testDataDir, mockMgmtClient } from '../../utils';

import Context from '../../../src/context/yaml';
import handler from '../../../src/context/yaml/handlers/themes';
import { mockTheme } from '../../tools/auth0/handlers/themes.tests';

describe('#YAML context themes', () => {
  it('should process themes', async () => {
    const theme = mockTheme();
    const dir = path.join(testDataDir, 'yaml', 'themes');
    cleanThenMkdir(dir);

    const yaml = toYaml({
      themes: [theme],
    });

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.themes).to.deep.equal([theme]);
  });

  it('should process multiple themes', async () => {
    const theme1 = mockTheme();
    theme1.displayName = 'Theme 1';
    const theme2 = mockTheme();
    theme2.displayName = 'Theme 2';

    const dir = path.join(testDataDir, 'yaml', 'themes');
    cleanThenMkdir(dir);

    const yaml = toYaml({
      themes: [theme1, theme2],
    });

    const yamlFile = path.join(dir, 'config.yaml');
    fs.writeFileSync(yamlFile, yaml);

    const config = { AUTH0_INPUT_FILE: yamlFile, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.loadAssetsFromLocal();

    expect(context.assets.themes).to.deep.equal([theme1, theme2]);
  });

  it('should dump themes', async () => {
    const theme = mockTheme();

    const dir = path.join(testDataDir, 'directory', 'themesDump');
    cleanThenMkdir(dir);

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());

    context.assets.themes = [theme];

    const dumped = await handler.dump(context);

    expect(dumped).to.deep.equal({ themes: [theme] });
  });

  it('should dump multiple themes', async () => {
    const theme1 = mockTheme();
    theme1.displayName = 'Theme 1';
    const theme2 = mockTheme();
    theme2.displayName = 'Theme 2';

    const dir = path.join(testDataDir, 'directory', 'themesDump');
    cleanThenMkdir(dir);

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());

    context.assets.themes = [theme1, theme2];

    const dumped = await handler.dump(context);

    expect(dumped).to.deep.equal({ themes: [theme1, theme2] });
  });
});
