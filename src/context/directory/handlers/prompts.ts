import path from 'path';
import { ensureDirSync } from 'fs-extra';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import {
  Prompts,
  PromptSettings,
  AllPromptsByLanguage,
} from '../../../tools/auth0/handlers/prompts';

type ParsedPrompts = ParsedAsset<'prompts', Prompts>;

const getPromptsDirectory = (filePath: string) => {
  return path.join(filePath, constants.PROMPTS_DIRECTORY);
};

const getPromptsSettingsFile = (promptsDirectory: string) => {
  return path.join(promptsDirectory, 'prompts.json');
};

const getCustomTextFile = (promptsDirectory: string) => {
  return path.join(promptsDirectory, 'custom-text.json');
};

function parse(context: DirectoryContext): ParsedPrompts {
  const promptsDirectory = getPromptsDirectory(context.filePath);
  if (!existsMustBeDir(promptsDirectory)) return { prompts: null }; // Skip

  const promptsSettings = (() => {
    const promptsSettingsFile = getPromptsSettingsFile(promptsDirectory);
    if (!isFile(promptsSettingsFile)) return {};
    return loadJSON(promptsSettingsFile, context.mappings) as PromptSettings;
  })();

  const customText = (() => {
    const customTextFile = getCustomTextFile(promptsDirectory);
    if (!isFile(customTextFile)) return {};
    return loadJSON(customTextFile, context.mappings) as AllPromptsByLanguage;
  })();

  return {
    prompts: {
      ...promptsSettings,
      customText,
    },
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { prompts } = context.assets;

  if (!prompts) return;

  const { customText, ...promptsSettings } = prompts;

  const promptsDirectory = getPromptsDirectory(context.filePath);
  ensureDirSync(promptsDirectory);

  if (!promptsSettings) return;
  const promptsSettingsFile = getPromptsSettingsFile(promptsDirectory);
  dumpJSON(promptsSettingsFile, promptsSettings);

  if (!customText) return;
  const customTextFile = getCustomTextFile(promptsDirectory);
  dumpJSON(customTextFile, customText);
}

const promptsHandler: DirectoryHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default promptsHandler;
