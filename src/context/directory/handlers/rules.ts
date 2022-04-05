import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';

import { DirectoryHandler } from './index';
import DirectoryContext from '..';

type ParsedRules = {
  rules: unknown[] | undefined;
};

function parse(context: DirectoryContext): ParsedRules {
  const rulesFolder = path.join(context.filePath, constants.RULES_DIRECTORY);
  if (!existsMustBeDir(rulesFolder)) return { rules: undefined }; // Skip

  const files: string[] = getFiles(rulesFolder, ['.json']);

  const rules = files.map((f) => {
    const rule = { ...loadJSON(f, context.mappings) };
    if (rule.script) {
      rule.script = context.loadFile(rule.script, constants.RULES_DIRECTORY);
    }
    return rule;
  });

  return {
    rules,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const rules = [...(context.assets.rules || [])];

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
    dumpJSON(ruleFile, { ...rule, script: `./${name}.js` });
  });
}

const rulesHandler: DirectoryHandler<ParsedRules> = {
  parse,
  dump,
};

export default rulesHandler;
