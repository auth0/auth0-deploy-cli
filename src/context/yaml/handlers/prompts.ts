import path from 'path';
import { ensureDirSync, readFileSync, writeFileSync } from 'fs-extra';
import { GetRendering200Response } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { constants } from '../../../tools';
import { ParsedAsset } from '../../../types';
import { Prompts, ScreenRenderer } from '../../../tools/auth0/handlers/prompts';
import { existsMustBeDir, loadJSON } from '../../../utils';
import log from '../../../logger';

type ParsedPrompts = ParsedAsset<'prompts', Prompts>;
// Type for the screen render array
type ScreenRenderYAML = Array<{
  [prompt: string]: {
    [screen: string]: string; // filename
  };
}>;

const getPromptsDirectory = (filePath: string) => path.join(filePath, constants.PROMPTS_DIRECTORY);

const loadScreenRenderers = (
  context: YAMLContext,
  screenRenderArray: ScreenRenderYAML
): GetRendering200Response[] => {
  // Array to store loaded renderers
  const loadedRenderers: GetRendering200Response[] = [];

  // Iterate through each entry in the ScreenRenderArray
  screenRenderArray.forEach((promptEntry) => {
    // Get the prompt (there will be only one key in each entry)
    const prompt = Object.keys(promptEntry)[0];

    // Get the screens for this prompt
    const screens = promptEntry[prompt];

    // Iterate through each screen for this prompt
    Object.entries(screens).forEach(([, fileName]) => {
      // Construct full file path
      const filePath = fileName;

      try {
        const rendererFile = path.join(context.basePath, filePath);

        const rendererData = loadJSON(rendererFile, {
          mappings: context.mappings,
          disableKeywordReplacement: context.disableKeywordReplacement,
        });

        // Add to the loadedRenderers array
        loadedRenderers.push(rendererData);
      } catch (error) {
        log.error(`Error loading file ${fileName}:`, error);
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

  const screenRendersYAML = prompts.screenRenderers as ScreenRenderYAML;

  prompts.screenRenderers = loadScreenRenderers(context, screenRendersYAML);

  return {
    prompts,
  };
}

const dumpScreenRenderers = (screenRenderers: ScreenRenderer[], outputDir: string) => {
  const screenRenderArray: ScreenRenderYAML = [];

  screenRenderers.forEach((renderer) => {
    const { tenant, ...screenRendererConfig } = renderer;
    if (!renderer.prompt || !renderer.screen) {
      log.error('Invalid screen renderer:', renderer);
      return;
    }
    const fileName = `${renderer.prompt}_${renderer.screen}.json`;
    const filePath = path.join(outputDir, fileName);

    log.info(`Writing ${filePath}`);

    // Write individual file
    writeFileSync(filePath, JSON.stringify(screenRendererConfig, null, 2));

    // Find or create entry for this prompt in the screenRenderArray
    let promptEntry = screenRenderArray.find((entry) => entry[renderer.prompt as string]);

    if (!promptEntry) {
      // If no entry exists for this prompt, create a new one
      promptEntry = { [renderer.prompt as string]: {} };
      screenRenderArray.push(promptEntry);
    }

    // Add screen to the prompt entry
    promptEntry[renderer.prompt as string][
      renderer.screen as string
    ] = `./prompts/renderSettings/${fileName}`;
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

  if (prompts.screenRenderers && prompts.screenRenderers.length > 0) {
    prompts.screenRenderers = dumpScreenRenderers(prompts.screenRenderers, renderSettingsDir);
  }
  return {
    prompts,
  };
}

const promptsHandler: YAMLHandler<ParsedPrompts> = {
  parse,
  dump,
};

export default promptsHandler;
