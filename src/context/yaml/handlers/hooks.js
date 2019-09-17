import path from 'path';
import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import { sanitize } from '../../../utils';
import log from '../../../logger';

async function parse(context) {
  // Load the script file for each hook
  if (!context.assets.hooks) return {};

  return {
    hooks: [
      ...context.assets.hooks.map((hook) => {
        if (hook.code) {
          hook.code = context.loadFile(hook.code, constants.HOOKS_DIRECTORY);
        }
        return { ...hook };
      })
    ]
  };
}


async function dump(context) {
  let hooks = [ ...context.assets.hooks || [] ];

  if (hooks.length > 0) {
    // Create hooks folder
    const hooksFolder = path.join(context.basePath, 'hooks');
    fs.ensureDirSync(hooksFolder);

    hooks = hooks.map((hook) => {
      // Dump hook code to file
      const scriptName = sanitize(`${hook.name}.js`);
      const scriptFile = path.join(hooksFolder, scriptName);
      log.info(`Writing ${scriptFile}`);
      fs.writeFileSync(scriptFile, hook.code);

      return { ...hook, code: `./hooks/${scriptName}` };
    });
  }

  return { hooks };
}


export default {
  parse,
  dump
};
