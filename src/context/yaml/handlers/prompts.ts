import path from 'path';
import { ensureDirSync, writeFileSync } from 'fs-extra';
import { Management } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { constants } from '../../../tools';
import { ParsedAsset } from '../../../types';
import { Prompts, ScreenRenderer } from '../../../tools/auth0/handlers/prompts';
import { loadJSON } from '../../../utils';
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
): Management.GetAculResponseContent[] => {
  // Array to store loaded renderers
  const loadedRenderers: Management.GetAculResponseContent[] = [];

  screenRenderArray.forEach((promptEntry) => {
    // Get the prompt (there will be only one key in each entry)
    const prompt = Object.keys(promptEntry)[0];

    const screens = promptEntry[prompt];

    Object.entries(screens).forEach(([, fileName]) => {
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

  if (prompts.screenRenderers && prompts.screenRenderers.length > 0) {
    const screenRendersYAML = prompts.screenRenderers as ScreenRenderYAML;
    prompts.screenRenderers = loadScreenRenderers(context, screenRendersYAML);
  }

  return {
    prompts,
  };
}

const dumpScreenRenderers = (context: YAMLContext, screenRenderers: ScreenRenderer[]) => {
  const screenRenderArray: ScreenRenderYAML = [];

  const promptsDirectory = getPromptsDirectory(context.basePath);
  ensureDirSync(promptsDirectory);

  // Create the directory for render settings if it doesn't exist
  const renderSettingsDir = path.join(promptsDirectory, constants.PROMPTS_SCREEN_RENDER_DIRECTORY);
  ensureDirSync(renderSettingsDir);

  screenRenderers.forEach((renderer) => {
    const { tenant, ...screenRendererConfig } = renderer;
    if (!renderer.prompt || !renderer.screen) {
      log.error('Invalid screen renderer:', renderer);
      return;
    }
    const fileName = `${renderer.prompt}_${renderer.screen}.json`;
    const filePath = path.join(renderSettingsDir, fileName);

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
    ] = `./prompts/${constants.PROMPTS_SCREEN_RENDER_DIRECTORY}/${fileName}`;
  });

  return screenRenderArray;
};

async function dump(context: YAMLContext): Promise<ParsedPrompts> {
  const { prompts } = context.assets;

  if (!prompts) return { prompts: null };

  if (prompts.screenRenderers && prompts.screenRenderers.length > 0) {
    prompts.screenRenderers = dumpScreenRenderers(context, prompts.screenRenderers);
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
