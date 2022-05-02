import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedPrompts = ParsedAsset<'prompts', Asset>;

async function parseAndDump(context: YAMLContext): Promise<ParsedPrompts> {
  const { prompts } = context.assets;

  if (!prompts) return { prompts: null };

  return {
    prompts,
  };
}

const promptsHandler: YAMLHandler<ParsedPrompts> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default promptsHandler;
