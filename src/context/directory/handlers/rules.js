import path from 'path';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import { logger } from '../../../logger';
import { groupFiles, existsMustBeDir, loadJSON } from '../../../utils';


function parseFileGroup(name, files, mappings) {
  const rule = { name };

  files.forEach((file) => {
    const { ext } = path.parse(file);
    if (ext === '.json') {
      Object.assign(rule, loadJSON(file, mappings));
    } else if (ext === '.js') {
      rule.script = loadFile(file, mappings);
    } else {
      logger.warn('Skipping non-rules file: ' + file);
    }
  });

  return rule;
}

export default function parse(folder, mappings) {
  const rulesFolder = path.join(folder, constants.RULES_DIRECTORY);
  existsMustBeDir(rulesFolder);
  const filesGrouped = groupFiles(rulesFolder);

  const rules = Object.entries(filesGrouped)
    .map(([ name, files ]) => parseFileGroup(name, files, mappings))
    .filter(p => Object.keys(p).length > 1); // Filter out invalid rules that have only name key set

  return {
    rules: {
      rules
    }
  };
}
