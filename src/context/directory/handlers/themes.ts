import path from 'path';
import { ensureDirSync } from 'fs-extra';
import { getFiles, dumpJSON, loadJSON, existsMustBeDir } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { Theme } from '../../../tools/auth0/handlers/themes';
import { constants } from '../../../tools';

type ParsedThemes = ParsedAsset<'themes', Theme[]>;

function parse(context: DirectoryContext): ParsedThemes {
  const baseFolder = path.join(context.filePath, constants.THEMES_DIRECTORY);
  if (!existsMustBeDir(baseFolder)) {
    return { themes: null };
  }

  const themeDefinitionsFiles = getFiles(baseFolder, ['.json']);
  if (!themeDefinitionsFiles.length) {
    return { themes: [] };
  }

  const themes = themeDefinitionsFiles.map(
    (themeDefinitionsFile) => loadJSON(themeDefinitionsFile, context.mappings) as Theme
  );

  return { themes };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { themes } = context.assets;
  if (!themes) {
    return;
  }

  const baseFolder = path.join(context.filePath, constants.THEMES_DIRECTORY);
  ensureDirSync(baseFolder);

  themes.forEach((themeDefinition, i) => {
    dumpJSON(path.join(baseFolder, `theme${i ? i : ''}.json`), themeDefinition);
  });
}

const themesHandler: DirectoryHandler<ParsedThemes> = {
  parse,
  dump,
};

export default themesHandler;
