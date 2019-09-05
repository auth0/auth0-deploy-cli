import path from 'path';
import fs from 'fs-extra';

import { sanitize } from '../../../utils';
import log from '../../../logger';
import { constants } from 'auth0-source-control-extension-tools';

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
      if (hook.code) {
        hook.code = context.loadFile(hook.code, constants.HOOKS_DIRECTORY);
      }
      return hook;
    });
  }

  return { hooks };
}


export default {
  parse,
  dump
};
