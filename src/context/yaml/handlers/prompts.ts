import path from 'path';
import { ensureDirSync } from 'fs-extra';
import fs from 'fs';
import { GetRendering200Response } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { constants } from '../../../tools';
import { ParsedAsset } from '../../../types';
import { Prompts } from '../../../tools/auth0/handlers/prompts';
import { existsMustBeDir } from '../../../utils';

const getPromptsDirectory = (filePath: string) => path.join(filePath, constants.PROMPTS_DIRECTORY);

type ParsedPrompts = ParsedAsset<'prompts', Prompts>;

// Type for the screen render array
type ScreenRenderArray = Array<{
  [prompt: string]: {
    [screen: string]: string // filename
  }
}>;

const loadScreenRenderers = (screenRenderArray: ScreenRenderArray, inputDir: string): GetRendering200Response[] => {
  // Array to store loaded renderers
  const loadedRenderers: GetRendering200Response[] = [];

  // Iterate through each entry in the ScreenRenderArray
  screenRenderArray.forEach(promptEntry => {
    // Get the prompt (there will be only one key in each entry)
    const prompt = Object.keys(promptEntry)[0];

    // Get the screens for this prompt
    const screens = promptEntry[prompt];

    // Iterate through each screen for this prompt
    Object.entries(screens).forEach(([, fileName]) => {
      // Construct full file path
      const filePath =  fileName;

      try {
        // Read and parse the JSON file
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const rendererData = JSON.parse(fileContent);

        // Add to the loadedRenderers array
        loadedRenderers.push(rendererData);
      } catch (error) {
        console.error(`Error loading file ${fileName}:`, error);
      }
    });
  });

  return loadedRenderers;
};

async function parse(context: YAMLContext): Promise<ParsedPrompts> {
  const { prompts } = context.assets;
  if (!prompts) return { prompts: null };

  const promptsDirectory = getPromptsDirectory(context.basePath);
  const renderSettingsDir = path.join(promptsDirectory, 'renderSettings');

  if (!existsMustBeDir(renderSettingsDir)) {
    prompts.screenRenderers = [];
    return { prompts: null };
  } // Skip

  const a = prompts.screenRenderers as ScreenRenderArray;
  console.log(a);

  prompts.screenRenderers = loadScreenRenderers(a,renderSettingsDir);

  return {
    prompts,
  };
}

const processScreenRenderers = (screenRenderers: any[], outputDir: string) => {
  // Resulting ScreenRenderArray to be returned
  const screenRenderArray: ScreenRenderArray = [];

  console.log(outputDir);

  // Process each renderer
  screenRenderers.forEach(renderer => {
    // Create filename in the format: promptName_screenName.json
    const fileName = `${renderer.prompt}_${renderer.screen}.json`;
    const filePath = path.join(outputDir, fileName);

    // Write individual file
    fs.writeFileSync(filePath, JSON.stringify(renderer, null, 2));

    // Find or create entry for this prompt in the screenRenderArray
    let promptEntry = screenRenderArray.find(entry => entry[renderer.prompt]);

    if (!promptEntry) {
      // If no entry exists for this prompt, create a new one
      promptEntry = { [renderer.prompt]: {} };
      screenRenderArray.push(promptEntry);
    }

    // Add screen to the prompt entry
    promptEntry[renderer.prompt][renderer.screen] = filePath;
  });

  return screenRenderArray;
};

async function dump(context: YAMLContext): Promise<ParsedPrompts> {
  const { prompts } = context.assets;

  if (!prompts) return { prompts: null };

  const promptsDirectory = getPromptsDirectory(context.basePath);
  ensureDirSync(promptsDirectory);

  // Create the directory for render settings if it doesn't exist
  const renderSettingsDir = path.join(promptsDirectory, 'renderSettings');
  ensureDirSync(renderSettingsDir);

  // @ts-ignore
  prompts.screenRenderers = processScreenRenderers(prompts.screenRenderers,renderSettingsDir);

  return {
    prompts,
  };
}

const promptsHandler: YAMLHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default promptsHandler;
