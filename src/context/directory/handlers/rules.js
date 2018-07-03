import path from 'path';
import { unifyScripts, constants } from 'auth0-source-control-extension-tools';

import { logger } from 'src/logger';
import { loadFile, groupFiles, existsMustBeDir } from 'src/utils';


function parseFileGroup(name, files, mappings) {
  const rule = { name };

  files.forEach((file) => {
    const content = loadFile(file, mappings);
    const { ext } = path.parse(file);
    if (ext === '.json') {
      rule.metadataFile = content;
      rule.metadata = true;
    } else if (ext === '.js') {
      rule.script = true;
      rule.scriptFile = content;
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
    rules: unifyScripts(rules, {})
  };
}
