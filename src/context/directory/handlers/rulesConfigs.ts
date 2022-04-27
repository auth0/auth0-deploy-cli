import path from 'path';
import { constants } from '../../../tools';

import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRulesConfigs = ParsedAsset<'rulesConfigs', Asset[]>;

function parse(context: DirectoryContext): ParsedRulesConfigs {
  const rulesConfigsFolder = path.join(context.filePath, constants.RULES_CONFIGS_DIRECTORY);
  if (!existsMustBeDir(rulesConfigsFolder)) return { rulesConfigs: null }; // Skip

  const foundFiles: string[] = getFiles(rulesConfigsFolder, ['.json']);

  const rulesConfigs = foundFiles
    .map((f) => loadJSON(f, context.mappings))
    .filter((p) => Object.keys(p).length > 0); // Filter out empty rulesConfigs

  return {
    rulesConfigs,
  };
}

async function dump(): Promise<void> {
  // do not export rulesConfigs as its values cannot be extracted
  return;
}

const rulesConfigsHandler: DirectoryHandler<ParsedRulesConfigs> = {
  parse,
  dump,
};

export default rulesConfigsHandler;
