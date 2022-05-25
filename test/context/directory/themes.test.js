import path from 'path';
import { expect } from 'chai';

import Context from '../../../src/context/directory';
import { testDataDir, createDir, mockMgmtClient, cleanThenMkdir } from '../../utils';
import { constants } from '../../../src/tools';
import { loadJSON } from '../../../src/utils';
import { validTheme } from '../../../src/tools/auth0/handlers/themes';
import handler from '../../../src/context/directory/handlers/themes';

describe('#directory context themes', () => {
  it('should process themes', async () => {
    const theme = validTheme();

    const dir = path.join(testDataDir, 'directory', 'themesProcess');
    createDir(dir, {
      [constants.THEMES_DIRECTORY]: { 'theme.json': JSON.stringify(theme) },
    });

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.themes).to.be.an('Array');
    expect(context.assets.themes).to.deep.equal([theme]);
  });

  it('should process multiple themes', async () => {
    const theme1 = validTheme();
    theme1.displayName = 'Theme 1';
    const theme2 = validTheme();
    theme2.displayName = 'Theme 2';

    const dir = path.join(testDataDir, 'directory', 'themesProcess');
    createDir(dir, {
      [constants.THEMES_DIRECTORY]: {
        'theme1.json': JSON.stringify(theme1),
        'theme2.json': JSON.stringify(theme2),
      },
    });

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());
    await context.load();

    expect(context.assets.themes).to.be.an('Array');
    expect(context.assets.themes).to.deep.equal([theme1, theme2]);
  });

  it('should dump themes', async () => {
    const theme = validTheme();

    const dir = path.join(testDataDir, 'directory', 'themesDump');
    cleanThenMkdir(dir);

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());

    context.assets.themes = [theme];

    await handler.dump(context);
    const dumped = loadJSON(path.join(dir, constants.THEMES_DIRECTORY, 'theme.json'));

    expect(dumped).to.deep.equal(theme);
  });

  it('should dump multiple themes', async () => {
    const themeJson = validTheme();
    themeJson.displayName = 'Theme';
    const theme1Json = validTheme();
    theme1Json.displayName = 'Theme 1';

    const dir = path.join(testDataDir, 'directory', 'themesDump');
    cleanThenMkdir(dir);

    const config = { AUTH0_INPUT_FILE: dir, AUTH0_KEYWORD_REPLACE_MAPPINGS: { foo: 'bar' } };
    const context = new Context(config, mockMgmtClient());

    context.assets.themes = [themeJson, theme1Json];

    await handler.dump(context);
    const dumpedThemeJson = loadJSON(path.join(dir, constants.THEMES_DIRECTORY, 'theme.json'));
    const dumpedTheme1Json = loadJSON(path.join(dir, constants.THEMES_DIRECTORY, 'theme1.json'));

    expect(dumpedThemeJson).to.deep.equal(themeJson);
    expect(dumpedTheme1Json).to.deep.equal(theme1Json);
  });
});
