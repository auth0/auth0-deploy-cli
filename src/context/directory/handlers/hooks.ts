import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import log from '../../../logger';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedHooks = ParsedAsset<'hooks', Asset[]>;

function parse(context: DirectoryContext): ParsedHooks {
  const hooksFolder = path.join(context.filePath, constants.HOOKS_DIRECTORY);
  if (!existsMustBeDir(hooksFolder)) return { hooks: null }; // Skip

  const files = getFiles(hooksFolder, ['.json']);

  const hooks = files.map((f) => {
    const hook = { ...loadJSON(f, context.mappings) };
    if (hook.script) {
      hook.script = context.loadFile(hook.script, constants.HOOKS_DIRECTORY);
    }

    hook.name = hook.name.toLowerCase().replace(/\s/g, '-');

    return hook;
  });

  return {
    hooks,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const hooks = context.assets.hooks;

  if (!hooks) return;

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
    dumpJSON(hookFile, { ...hook, script: `./${name}.js` });
  });
}

const hooksHandler: DirectoryHandler<ParsedHooks> = {
  parse,
  dump,
};

export default hooksHandler;
