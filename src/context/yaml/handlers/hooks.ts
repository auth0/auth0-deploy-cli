import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import { sanitize } from '../../../utils';
import log from '../../../logger';

import { YAMLHandler } from '.'
import YAMLContext from '..'

type ParsedHooks = {
  hooks: unknown[]
} | {}

async function parse(context: YAMLContext): Promise<ParsedHooks> {
  // Load the script file for each hook
  if (!context.assets.hooks) return {};

  return {
    hooks: [
      ...context.assets.hooks.map((hook) => {
        if (hook.script) {
          //@ts-ignore TODO: understand why two arguments are passed when context.loadFile only accepts one
          hook.script = context.loadFile(hook.script, constants.HOOKS_DIRECTORY);
        }

        hook.name = hook.name.toLowerCase().replace(/\s/g, '-');

        return { ...hook };
      })
    ]
  };
}

async function dump(context: YAMLContext): Promise<ParsedHooks> {
  let hooks = [...context.assets.hooks || []];

  if (hooks.length > 0) {
    // Create hooks folder
    const hooksFolder = path.join(context.basePath, 'hooks');
    fs.ensureDirSync(hooksFolder);

    hooks = hooks.map((hook) => {
      // Dump hook code to file
      // For cases when hook does not have `meta['hook-name']`
      hook.name = hook.name || hook.id;
      const codeName = sanitize(`${hook.name}.js`);
      const codeFile = path.join(hooksFolder, codeName);
      log.info(`Writing ${codeFile}`);
      fs.writeFileSync(codeFile, hook.script);

      return { ...hook, script: `./hooks/${codeName}` };
    });
  }

  return { hooks };
}

const hooksHandler: YAMLHandler<ParsedHooks> = {
  parse,
  dump,
};

export default hooksHandler;