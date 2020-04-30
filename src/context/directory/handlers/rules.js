import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';


function parse(context) {
  const rulesFolder = path.join(context.filePath, constants.RULES_DIRECTORY);
  if (!existsMustBeDir(rulesFolder)) return { rules: undefined }; // Skip

  const files = getFiles(rulesFolder, [ '.json' ]);

  const rules = files.map((f) => {
    const rule = { ...loadJSON(f, context.mappings) };
    if (rule.script) {
      rule.script = context.loadFile(rule.script, constants.RULES_DIRECTORY);
    }
    return rule;
  });

  return {
    rules
  };
}


async function dump(context) {
  const rules = [ ...context.assets.rules || [] ];

  if (!rules) return; // Skip, nothing to dump

  // Create Rules folder
  const rulesFolder = path.join(context.filePath, constants.RULES_DIRECTORY);
  fs.ensureDirSync(rulesFolder);
  rules.forEach((rule) => {
    // Dump script to file
    const name = sanitize(rule.name);
    const ruleJS = path.join(rulesFolder, `${name}.js`);
    log.info(`Writing ${ruleJS}`);
    fs.writeFileSync(ruleJS, rule.script);

    // Dump template metadata
    const ruleFile = path.join(rulesFolder, `${name}.json`);
    log.info(`Writing ${ruleFile}`);
    fs.writeFileSync(ruleFile, JSON.stringify({ ...rule, script: `./${name}.js` }, null, 2));
  });
}


export default {
  parse,
  dump
};
