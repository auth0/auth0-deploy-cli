import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';
import log from '../../../logger';


function parse(context) {
  const hooksFolder = path.join(context.filePath, constants.HOOKS_DIRECTORY);
  if (!existsMustBeDir(hooksFolder)) return { hooks: undefined }; // Skip

  const files = getFiles(hooksFolder, [ '.json' ]);

  const hooks = files.map((f) => {
    const hook = { ...loadJSON(f, context.mappings) };
    if (hook.script) {
      hook.script = context.loadFile(hook.script, constants.HOOKS_DIRECTORY);
    }

    hook.name = hook.name.toLowerCase().replace(/\s/g, '-');

    return hook;
  });

  return {
    hooks
  };
}

async function dump(context) {
  const hooks = [ ...context.assets.hooks || [] ];

  if (hooks.length < 1) return;

  // Create Hooks folder
  const hooksFolder = path.join(context.filePath, constants.HOOKS_DIRECTORY);
  fs.ensureDirSync(hooksFolder);
  hooks.forEach((hook) => {
    // Dump script to file
    // For cases when hook does not have `meta['hook-name']`
    hook.name = hook.name || hook.id;
    const name = sanitize(hook.name);
    const hookCode = path.join(hooksFolder, `${name}.js`);
    log.info(`Writing ${hookCode}`);
    fs.writeFileSync(hookCode, hook.script);

    // Dump template metadata
    const hookFile = path.join(hooksFolder, `${name}.json`);
    log.info(`Writing ${hookFile}`);
    fs.writeFileSync(hookFile, JSON.stringify({ ...hook, script: `./${name}.js` }, null, 2));
  });
}

export default {
  parse,
  dump
};
