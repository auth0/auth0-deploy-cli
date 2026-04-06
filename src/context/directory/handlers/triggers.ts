import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';

import { getFiles, existsMustBeDir, loadJSON, dumpJSON } from '../../../utils';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTriggers = ParsedAsset<'triggers', Asset>;

function parse(context: DirectoryContext): ParsedTriggers {
  const triggersFolder = path.join(context.filePath, constants.TRIGGERS_DIRECTORY);

  if (!existsMustBeDir(triggersFolder)) return { triggers: null }; // Skip

  const files = getFiles(triggersFolder, ['.json']);

  const triggers = {
    ...loadJSON(files[0], {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  };

  return { triggers };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { triggers } = context.assets;

  if (!triggers) return;

  // Create triggers folder
  const triggersFolder = path.join(context.filePath, constants.TRIGGERS_DIRECTORY);
  fs.ensureDirSync(triggersFolder);
  const triggerFile = path.join(triggersFolder, 'triggers.json');
  dumpJSON(triggerFile, triggers);
}

const triggersHandler: DirectoryHandler<ParsedTriggers> = {
  parse,
  dump,
};

export default triggersHandler;
