import path from 'path';
import fs from 'fs-extra';

import log from '../../../logger';

async function parse(context) {
  // Load the script file for each rule
  const rules = context.assets.rules || [];

  return {
    rules: [
      ...rules.map(rule => ({
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
      const scriptFile = path.join(rulesFolder, `${rule.name}.js`);
      log.info(`Writing ${scriptFile}`);
      fs.writeFileSync(scriptFile, rule.script);
      return { ...rule, script: `./${rule.name}.js` };
    });
  }

  return { rules };
}


export default {
  parse,
  dump
};
