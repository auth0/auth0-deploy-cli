import path from 'path';
import { ensureDirSync } from 'fs-extra';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, getFiles } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedPrompts = ParsedAsset<'prompts', Asset & { customText: { [key: string]: Asset[] } }>;

const getPromptsDirectory = (filePath: string) => {
  return path.join(filePath, constants.PROMPTS_DIRECTORY);
};

const getPromptsFile = (promptsDirectory: string) => {
  return path.join(promptsDirectory, 'prompts.json');
};

function parse(context: DirectoryContext): ParsedPrompts {
  const promptsDirectory = getPromptsDirectory(context.filePath);
  if (!existsMustBeDir(promptsDirectory)) return { prompts: null }; // Skip

  const prompts = (() => {
    const promptsFile = getPromptsFile(promptsDirectory);
    return loadJSON(promptsFile, context.mappings);
  })();

  return {
    prompts,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { prompts } = context.assets;

  if (!prompts) return;

  const promptsDirectory = getPromptsDirectory(context.filePath);
  ensureDirSync(promptsDirectory);
  dumpJSON(getPromptsFile(promptsDirectory), prompts);
}

const logStreamsHandler: DirectoryHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default logStreamsHandler;
