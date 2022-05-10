import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Prompts } from '../../../tools/auth0/handlers/prompts';

type ParsedPrompts = ParsedAsset<'prompts', Prompts>;

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
