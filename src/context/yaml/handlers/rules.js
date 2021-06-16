import path from 'path';
import fs from 'fs-extra';

import { sanitize } from '../../../utils';
import log from '../../../logger';

async function parse(context) {
  // Load the script file for each rule
  if (!context.assets.rules) return {};

  return {
    rules: [
      ...context.assets.rules.map((rule) => ({
        ...rule,
        script: context.loadFile(rule.script)
      }))
    ]
  };
}

async function dump(context) {
  let rules = [ ...context.assets.rules || [] ];

  if (rules.length > 0) {
    // Create Rules folder
    const rulesFolder = path.join(context.basePath, 'rules');
    fs.ensureDirSync(rulesFolder);

    rules = rules.map((rule) => {
      // Dump rule to file
      const scriptName = sanitize(`${rule.name}.js`);
      const scriptFile = path.join(rulesFolder, scriptName);
      log.info(`Writing ${scriptFile}`);
      fs.writeFileSync(scriptFile, rule.script);
      return { ...rule, script: `./rules/${scriptName}` };
    });
  }

  return { rules };
}

export default {
  parse,
  dump
};
