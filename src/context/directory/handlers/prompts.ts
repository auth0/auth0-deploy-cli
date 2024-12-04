import path from 'path';
import fs from 'fs-extra';
import { ensureDirSync, writeFileSync } from 'fs-extra';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';
import {getFiles, dumpJSON, existsMustBeDir, isFile, loadJSON } from '../../../utils';
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
  Prompts, PromptScreenRenderSettings, PromptSettings, ScreenConfig,
} from '../../../tools/auth0/handlers/prompts';

type ParsedPrompts = ParsedAsset<'prompts', Prompts>;

const getPromptsDirectory = (filePath: string) => path.join(filePath, constants.PROMPTS_DIRECTORY);

const getPromptsSettingsFile = (promptsDirectory: string) =>
  path.join(promptsDirectory, 'prompts.json');

const getCustomTextFile = (promptsDirectory: string) =>
  path.join(promptsDirectory, 'custom-text.json');

const getPartialsFile = (promptsDirectory: string) => path.join(promptsDirectory, 'partials.json');

const getPromptScreenSettingsFile = (promptsDirectory: string) => path.join(promptsDirectory, 'promptScreenSettings.json');

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

  const promptScreenSettings = (() => {
    const screenSettingsDir = path.join(context.filePath, 'renderSettings');
    if (!existsMustBeDir(screenSettingsDir)) return {};

    const screenSettingsFiles = getFiles(screenSettingsDir, ['.json']);

    const renderSettings = screenSettingsFiles.map((f) => {
      const renderSetting = {
        ...loadJSON(f, {
          mappings: context.mappings,
          disableKeywordReplacement: context.disableKeywordReplacement,
        }) as PromptScreenRenderSettings
      };
      return renderSetting as PromptScreenRenderSettings;
    });

    return Object.entries(renderSettings).reduce((acc, [promptName, screens]) => {
      console.log('Current promptName:', promptName);
      console.log('Initial acc:', JSON.stringify(acc, null, 2));

      // Create an object to collect screens for this prompt type
      const promptScreens: Record<string, any> = {};

      // Iterate over the screens object directly
      Object.entries(screens).forEach(([screenName, filePath]) => {
        console.log('Current screenName:', screenName);
        console.log('File path:', filePath);

        let fileContent = {};
        try {
          const fileData = fs.readFileSync(filePath, 'utf-8');
          fileContent = JSON.parse(fileData);
        } catch (error) {
          console.error(`Error reading or parsing file at ${filePath}:`, error);
          fileContent = { error: `Failed to load ${filePath}` }; // Fallback content
        }

        console.log('File content:', JSON.stringify(fileContent, null, 2));

        // Store the file content under the screen name
        promptScreens[screenName] = fileContent;
      });

      // Modify the accumulator to be an object instead of pushing to an array
      acc[promptName] = promptScreens;
      console.log('Updated acc:', JSON.stringify(acc, null, 2));

      return acc;
    }, {} as PromptScreenRenderSettings);
  })();

  console.log('Final partials:', JSON.stringify(partials, null, 2));
  //   if (!isFile(screenSettingsFile)) return {};
  //   const settingsFileContent = loadJSON(screenSettingsFile, {
  //     mappings: context.mappings,
  //     disableKeywordReplacement: context.disableKeywordReplacement,
  //   }) as PromptScreenRenderSettings;
  //
  //   return Object.entries(settingsFileContent).reduce((acc, [promptName, screensArray]) => {
  //     const screensObject = screensArray[0] as Record<ScreenTypes, PromptScreenRenderSettings[]>;
  //     acc[promptName as PromptTypes] = Object.entries(screensObject).reduce(
  //       (screenAcc, [screenName, items]) => {
  //         screenAcc[screenName as ScreenTypes] = items.reduce(
  //           (insertionAcc, { name, body }) => {
  //             const templateFilePath = path.join(promptsDirectory, body);
  //             insertionAcc[name] = isFile(templateFilePath)
  //               ? loadFileAndReplaceKeywords(templateFilePath, {
  //                 mappings: context.mappings,
  //                 disableKeywordReplacement: context.disableKeywordReplacement,
  //               }).trim()
  //               : '';
  //             return insertionAcc;
  //           },
  //           {} as Record<string, string>
  //         );
  //         return screenAcc;
  //       },
  //       {} as Record<CustomPartialsScreenTypes, Record<string, string>>
  //     );
  //     return acc;
  //   }, {} as Record<PromptTypes, Record<ScreenTypes, PromptScreenSettings[]>>);
  // })();

  return {
    prompts: {
      ...promptsSettings,
      customText,
      partials,
      ...promptScreenSettings,
    },
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { prompts } = context.assets;

  if (!prompts) return;

  const { customText, partials, screenRenderer, ...promptsSettings } = prompts;

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

  if (!screenRenderer) return ;
  const screenSettingsFile =  getPromptScreenSettingsFile(promptsDirectory);

  const transformedScreenSettings = Object.entries(screenRenderer).reduce((acc, [promptName, screens]) => {
    // Create the directory for render settings if it doesn't exist
    const renderSettingsDir = path.join(context.filePath, 'renderSettings');
    ensureDirSync(renderSettingsDir);

    console.log(screenRenderer);

    // Iterate through screens for this prompt
    Object.entries(screens).forEach(([screenName, screenSettings]) => {
      // Generate the file path with the format: [promptName]_[screenName].json

      const screenSettingsFilePath = path.join(renderSettingsDir, `${promptName}_${screenName}.json`);
      console.log(`Writing ${screenSettingsFilePath}`);

      // Write the screen settings to a JSON file
      try {
        writeFileSync(
          screenSettingsFilePath,
          JSON.stringify(screenSettings, null, 2),
          'utf8'
        );

        // Track the file path in the accumulator
        if (!acc[promptName]) {
          acc[promptName] = {};
        }
        acc[promptName][screenName] = path.relative(context.filePath, screenSettingsFilePath);
      } catch (error) {
        console.error(`Error writing screen settings for ${promptName}/${screenName}:`, error);
      }
    });

    return acc;
  }, {} as Record<string, Record<string, string>>);

  dumpJSON(screenSettingsFile, transformedScreenSettings);
}

const promptsHandler: DirectoryHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default promptsHandler;
