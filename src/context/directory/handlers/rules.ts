import path from 'path';
import fs from 'fs-extra';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';

import { DirectoryHandler } from './index';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRules = ParsedAsset<'rules', Asset[]>;

function parse(context: DirectoryContext): ParsedRules {
  const rulesFolder = path.join(context.filePath, constants.RULES_DIRECTORY);
  if (!existsMustBeDir(rulesFolder)) return { rules: null }; // Skip

  const files: string[] = getFiles(rulesFolder, ['.json']);

  const rules = files.map((f) => {
    const rule = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    if (rule.script) {
      const normalizedScript = rule.script.replace(/\\/g, '/');
      const configRoot = path.resolve(context.filePath);
      const resolvedPath = path.resolve(context.filePath, constants.RULES_DIRECTORY, normalizedScript);
      if (!resolvedPath.startsWith(configRoot + path.sep)) {
        if (context.config.AUTH0_ALLOW_EXTERNAL_CODE_PATHS) {
          log.debug(
            `Loading file outside config directory (AUTH0_ALLOW_EXTERNAL_CODE_PATHS enabled): "${rule.script}"`
          );
        } else {
          log.warn(
            `Path "${rule.script}" resolves to "${resolvedPath}" which is outside the config directory "${configRoot}". ` +
              `This will be blocked as an error in the next major release. ` +
              `Move the file inside your config directory or set AUTH0_ALLOW_EXTERNAL_CODE_PATHS=true to allow it.`
          );
        }
      }
      rule.script = loadFileAndReplaceKeywords(resolvedPath, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      });
    }
    return rule;
  });

  return {
    rules,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  let { rules } = context.assets;

  if (!rules) return; // Skip, nothing to dump

  // Filter excluded rules
  const excludedRules = (context.assets.exclude && context.assets.exclude.rules) || [];
  if (excludedRules.length) {
    rules = rules.filter((rule) => !excludedRules.includes(rule.name));
  }

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
