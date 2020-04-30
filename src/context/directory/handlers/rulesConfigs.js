import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';

function parse(context) {
  const rulesConfigsFolder = path.join(context.filePath, constants.RULES_CONFIGS_DIRECTORY);
  if (!existsMustBeDir(rulesConfigsFolder)) return { rulesConfigs: undefined }; // Skip

  const foundFiles = getFiles(rulesConfigsFolder, [ '.json' ]);

  const rulesConfigs = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty rulesConfigs

  return {
    rulesConfigs
  };
}


async function dump() {
  // do not export rulesConfigs as its values cannot be extracted
  return null;
}


export default {
  parse,
  dump
};
