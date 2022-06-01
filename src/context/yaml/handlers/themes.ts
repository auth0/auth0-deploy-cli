import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Theme } from '../../../tools/auth0/handlers/themes';

type ParsedThemes = ParsedAsset<'themes', Theme[]>;

async function parseAndDump(context: YAMLContext): Promise<ParsedThemes> {
  const { themes } = context.assets;

  if (!themes) return { themes: null };

  return {
    themes,
  };
}

const themesHandler: YAMLHandler<ParsedThemes> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default themesHandler;
