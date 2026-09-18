import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianSettings = ParsedAsset<'guardianSettings', Asset>;

function parse(context: DirectoryContext): ParsedGuardianSettings {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return { guardianSettings: null }; // Skip

  const file = path.join(guardianFolder, 'settings.json');

  if (!isFile(file)) {
    return { guardianSettings: null };
  }

  return {
    guardianSettings: loadJSON(file, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianSettings } = context.assets;

  if (!guardianSettings) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'settings.json');
  dumpJSON(file, guardianSettings);
}

const guardianSettingsHandler: DirectoryHandler<ParsedGuardianSettings> = {
  parse,
  dump,
};

export default guardianSettingsHandler;
