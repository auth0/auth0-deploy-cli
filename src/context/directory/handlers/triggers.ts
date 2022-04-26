import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';

import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';
import log from '../../../logger';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTriggers = {
  triggers: Asset[] | null;
};

function parse(context: DirectoryContext): ParsedTriggers {
  const triggersFolder = path.join(context.filePath, constants.TRIGGERS_DIRECTORY);

  if (!existsMustBeDir(triggersFolder)) return { triggers: null }; // Skip

  const files = getFiles(triggersFolder, ['.json']);

  const triggers = { ...loadJSON(files[0], context.mappings) };

  return { triggers };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { triggers } = context.assets;

  if (!triggers) return;

  // Create triggers folder
  const triggersFolder = path.join(context.filePath, constants.TRIGGERS_DIRECTORY);
  fs.ensureDirSync(triggersFolder);
  const triggerFile = path.join(triggersFolder, 'triggers.json');
  log.info(`Writing ${triggerFile}`);
  fs.writeFileSync(triggerFile, JSON.stringify(triggers, null, 2));
}

const triggersHandler: DirectoryHandler<ParsedTriggers> = {
  parse,
  dump,
};

export default triggersHandler;
