import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';
import log from '../../../logger';

function parse(context) {
  const rulesConfigsFolder = path.join(context.filePath, constants.RULES_CONFIGS_DIRECTORY);
  if (!existsMustBeDir(rulesConfigsFolder)) return { rulesConfigs: [] }; // Skip

  const foundFiles = getFiles(rulesConfigsFolder, [ '.json' ]);

  const rulesConfigs = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty rulesConfigs

  return {
    rulesConfigs
  };
}


async function dump(context) {
  const { rulesConfigs } = context.assets;

  if (!rulesConfigs) return; // Skip, nothing to dump

  const ruleConfigsFolder = path.join(context.filePath, constants.RULES_CONFIGS_DIRECTORY);
  fs.ensureDirSync(ruleConfigsFolder);

  rulesConfigs.forEach((rulesConfig) => {
    const ruleConfigFile = path.join(ruleConfigsFolder, `${rulesConfig.key}.json`);
    log.info(`Writing ${ruleConfigFile}`);
    fs.writeFileSync(ruleConfigFile, JSON.stringify({
      value: '******',
      ...rulesConfig
    }, null, 2));
  });
}


export default {
  parse,
  dump
};
