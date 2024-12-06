import path from 'path';
import { ensureDirSync, writeFileSync } from 'fs-extra';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';
import { getFiles, dumpJSON, existsMustBeDir, isFile, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import {
  AllPromptsByLanguage,
  CustomPartialsConfig,
  CustomPartialsInsertionPoints,
  CustomPartialsPromptTypes,
  CustomPartialsScreenTypes,
  CustomPromptPartialsScreens,
  Prompts,
  PromptSettings,
  ScreenConfig,
  ScreenRenderer,
} from '../../../tools/auth0/handlers/prompts';

type ParsedPrompts = ParsedAsset<'prompts', Prompts>;

const getPromptsDirectory = (filePath: string) => path.join(filePath, constants.PROMPTS_DIRECTORY);

const getPromptsSettingsFile = (promptsDirectory: string) =>
  path.join(promptsDirectory, 'prompts.json');

const getCustomTextFile = (promptsDirectory: string) =>
  path.join(promptsDirectory, 'custom-text.json');

const getPartialsFile = (promptsDirectory: string) => path.join(promptsDirectory, 'partials.json');

const getScreenRenderSettingsDir = (promptsDirectory: string) =>
  path.join(promptsDirectory, 'screenRenderSettings');

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

    return Object.entries(partialsFileContent).reduce((acc, [promptName, screensArray]) => {
      const screensObject = screensArray[0] as Record<CustomPartialsScreenTypes, ScreenConfig[]>;
      acc[promptName as CustomPartialsPromptTypes] = Object.entries(screensObject).reduce(
        (screenAcc, [screenName, items]) => {
          screenAcc[screenName as CustomPartialsScreenTypes] = items.reduce(
            (insertionAcc, { name, template }) => {
              const templateFilePath = path.join(promptsDirectory, template);
              insertionAcc[name] = isFile(templateFilePath)
                ? loadFileAndReplaceKeywords(templateFilePath, {
                  mappings: context.mappings,
                  disableKeywordReplacement: context.disableKeywordReplacement,
                }).trim()
                : '';
              return insertionAcc;
            },
            {} as Record<string, string>
          );
          return screenAcc;
        },
        {} as Record<CustomPartialsScreenTypes, Record<string, string>>
      );
      return acc;
    }, {} as Record<CustomPartialsPromptTypes, Record<CustomPartialsScreenTypes, Record<string, string>>>);
  })();

  const screenRenderers = (() => {
    const screenRenderSettingsDir = getScreenRenderSettingsDir(promptsDirectory);
    if (!existsMustBeDir(screenRenderSettingsDir)) return [];

    const screenSettingsFiles = getFiles(screenRenderSettingsDir, ['.json']);

    const renderSettings: ScreenRenderer[] = screenSettingsFiles.map((f) => {
      const renderSetting = {
        ...loadJSON(f, {
          mappings: context.mappings,
          disableKeywordReplacement: context.disableKeywordReplacement,
        }),
      };
      return renderSetting as ScreenRenderer;
    });

    return renderSettings as ScreenRenderer[];
  })();

  return {
    prompts: {
      ...promptsSettings,
      customText,
      partials,
      screenRenderers,
    },
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { prompts } = context.assets;

  if (!prompts) return;

  const { customText, partials, screenRenderers, ...promptsSettings } = prompts;

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

  const transformedPartials = Object.entries(partials).reduce((acc, [promptName, screens]) => {
    acc[promptName as CustomPartialsPromptTypes] = [
      Object.entries(screens as CustomPromptPartialsScreens).reduce(
        (screenAcc, [screenName, insertionPoints]) => {
          screenAcc[screenName as CustomPartialsScreenTypes] = Object.entries(
            insertionPoints as Partial<Record<CustomPartialsInsertionPoints, string>>
          ).map(([insertionPoint, template]) => {
            const templateFilePath = path.join(
              promptsDirectory,
              'partials',
              promptName,
              screenName,
              `${insertionPoint}.liquid`
            );
            ensureDirSync(path.dirname(templateFilePath));
            writeFileSync(templateFilePath, template, 'utf8');
            return {
              name: insertionPoint,
              template: path.relative(promptsDirectory, templateFilePath), // Path relative to `promptsDirectory`
            };
          });
          return screenAcc;
        },
        {} as Record<CustomPartialsScreenTypes, ScreenConfig[]>
      ),
    ];
    return acc;
  }, {} as CustomPartialsConfig);

  dumpJSON(partialsFile, transformedPartials);

  if (!screenRenderers) return;
  const screenRenderSettingsDir = getScreenRenderSettingsDir(promptsDirectory);
  ensureDirSync(screenRenderSettingsDir);

  for (let index = 0; index < screenRenderers.length; index++) {
    const screenRenderersSetting = screenRenderers[index];
    delete screenRenderersSetting.tenant;
    const fileName = `${screenRenderersSetting.prompt}_${screenRenderersSetting.screen}.json`;
    const screenSettingsFilePath = path.join(screenRenderSettingsDir, fileName);

    dumpJSON(screenSettingsFilePath, screenRenderersSetting);
  }
}

const promptsHandler: DirectoryHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default promptsHandler;
