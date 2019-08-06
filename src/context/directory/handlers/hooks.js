import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';


function parse(context) {
  const hooksFolder = path.join(context.filePath, constants.HOOKS_DIRECTORY);
  if (!existsMustBeDir(hooksFolder)) return { hooks: [] }; // Skip

  const files = getFiles(hooksFolder, [ '.json' ]);

  const hooks = files.map((f) => {
    const hook = { ...loadJSON(f, context.mappings) };
    if (hook.code) {
      hook.code = context.loadFile(hook.code, constants.HOOKS_DIRECTORY);
    }
    return hook;
  });

  return {
    hooks
  };
}

export default {
  parse
};
