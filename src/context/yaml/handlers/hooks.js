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
        if (hook.script) {
          hook.script = context.loadFile(hook.script, constants.HOOKS_DIRECTORY);
        }

        hook.name = hook.name.toLowerCase().replace(/\s/g, '-');

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


export default {
  parse,
  dump
};
