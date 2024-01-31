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
  CustomPromptsConfig,
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

const getPartialsFile = (promptsDirectory: string) => {
  return path.join(promptsDirectory, 'partials.json');
};

function parse(context: DirectoryContext): ParsedPrompts {
  const promptsDirectory = getPromptsDirectory(context.filePath);
  if (!existsMustBeDir(promptsDirectory)) return { prompts: null }; // Skip

  const promptsSettings = (() => {
    const promptsSettingsFile = getPromptsSettingsFile(promptsDirectory);
    if (!isFile(promptsSettingsFile)) return {};
    return loadJSON(promptsSettingsFile, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }) as PromptSettings;
  })();

  const customText = (() => {
    const customTextFile = getCustomTextFile(promptsDirectory);
    if (!isFile(customTextFile)) return {};
    return loadJSON(customTextFile, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }) as AllPromptsByLanguage;
  })();

  const partials = (() => {
    const partialsFile = getPartialsFile(promptsDirectory);
    if (!isFile(partialsFile)) return {};
    const partialsFileContent = loadJSON(partialsFile, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }) as CustomPromptsConfig;

    Object.entries(partialsFileContent).forEach(([promptName, partialsArray]) => {
      partialsArray.forEach((partialConfig, i) => {
        if (partialConfig.template) {
          partialsFileContent[promptName][i].template = context.loadFile(
            path.join(promptsDirectory, partialConfig.template),
            promptsDirectory
          );
        }
      });
    });

    return partialsFileContent;
  })();

  return {
    prompts: {
      ...promptsSettings,
      customText,
      partials,
    },
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { prompts } = context.assets;

  if (!prompts) return;

  const { customText, partials, ...promptsSettings } = prompts;

  const promptsDirectory = getPromptsDirectory(context.filePath);
  ensureDirSync(promptsDirectory);

  if (!promptsSettings) return;
  const promptsSettingsFile = getPromptsSettingsFile(promptsDirectory);
  dumpJSON(promptsSettingsFile, promptsSettings);

  if (!customText) return;
  const customTextFile = getCustomTextFile(promptsDirectory);
  dumpJSON(customTextFile, customText);

  if (!partials) return;
  const partialsFile = getPartialsFile(promptsDirectory);
  dumpJSON(partialsFile, partials);
}

const promptsHandler: DirectoryHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default promptsHandler;
