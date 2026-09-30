import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianEmailFactorSettings = ParsedAsset<'guardianEmailFactorSettings', Asset>;

function parse(context: DirectoryContext): ParsedGuardianEmailFactorSettings {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return { guardianEmailFactorSettings: null }; // Skip

  const file = path.join(guardianFolder, 'emailFactorSettings.json');

  if (!isFile(file)) {
    return { guardianEmailFactorSettings: null };
  }

  return {
    guardianEmailFactorSettings: loadJSON(file, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianEmailFactorSettings } = context.assets;

  if (!guardianEmailFactorSettings) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'emailFactorSettings.json');
  dumpJSON(file, guardianEmailFactorSettings);
}

const guardianEmailFactorSettingsHandler: DirectoryHandler<ParsedGuardianEmailFactorSettings> = {
  parse,
  dump,
};

export default guardianEmailFactorSettingsHandler;
