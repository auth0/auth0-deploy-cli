import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';
import log from '../../../logger';


function parse(context) {
  const triggersFolder = path.join(context.filePath, constants.TRIGGERS_DIRECTORY);

  if (!existsMustBeDir(triggersFolder)) return { triggers: undefined }; // Skip

  const files = getFiles(triggersFolder, [ '.json' ]);

  const triggers = { ...loadJSON(files[0], context.mappings) };

  return { triggers };
}


async function dump(context) {
  const { triggers } = context.assets;

  if (!triggers) return;

  // Create triggers folder
  const triggersFolder = path.join(context.filePath, constants.TRIGGERS_DIRECTORY);
  fs.ensureDirSync(triggersFolder);
  const triggerFile = path.join(triggersFolder, 'triggers.json');
  log.info(`Writing ${triggerFile}`);
  fs.writeFileSync(triggerFile, JSON.stringify(triggers, null, 2));
}

export default {
  parse,
  dump
};
