import path from 'path';
import { ensureDirSync, readFileSync, writeFileSync } from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, isFile, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import {
  AllPromptsByLanguage,
  CustomPartialsConfig,
  CustomPartialsPromptTypes,
  Prompts,
  PromptSettings
} from '../../../tools/auth0/handlers/prompts';
import log from '../../../logger';

type ParsedPrompts = ParsedAsset<'prompts', Prompts>;

const getPromptsDirectory = (filePath: string) => path.join(filePath, constants.PROMPTS_DIRECTORY);

const getPromptsSettingsFile = (promptsDirectory: string) => path.join(promptsDirectory, 'prompts.json');

const getCustomTextFile = (promptsDirectory: string) => path.join(promptsDirectory, 'custom-text.json');

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
    }) as CustomPartialsConfig;

    return Object.entries(partialsFileContent).reduce((acc, [promptName, items]) => {
      acc[promptName] = items.reduce((screenAcc, { name, template }) => {
        if (!screenAcc[promptName]) {
          screenAcc[promptName] = {};
        }

        // Read template content from the file
        const templateFilePath = path.join(promptsDirectory, template);
        if (isFile(templateFilePath)) {
          const templateContent = readFileSync(templateFilePath, 'utf8');
          if (templateContent.trim()) {
            screenAcc[promptName][name] = templateContent;
          }
        }

        return screenAcc;
      }, {} as Record<string, Record<string, string>>);
      return acc;
    }, {} as Record<CustomPartialsPromptTypes, Record<string, Record<string, string>>>);
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

  // Transform the partials data back to CustomPartialsConfig format
  const transformedPartials = Object.entries(partials).reduce((acc, [promptName, screens]) => {
    acc[promptName] = Object.entries(screens).map(([, insertionPoints]) => Object.entries(insertionPoints).map(([insertionPoint, template]) => {
      const templateFilePath = path.join(promptsDirectory, 'partials', promptName, `${insertionPoint}.liquid`);
      ensureDirSync(path.dirname(templateFilePath));
      writeFileSync(templateFilePath, template, 'utf8');
      return {
        name: insertionPoint,
        template: path.relative(promptsDirectory, templateFilePath) // Path relative to `promptsDirectory`
      };
    })).flat(); // Flatten the nested arrays into a single array
    return acc;
  }, {} as CustomPartialsConfig);

  dumpJSON(partialsFile, transformedPartials);
}

const promptsHandler: DirectoryHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default promptsHandler;
