import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianPhoneFactorSettings = ParsedAsset<'guardianPhoneFactorSettings', Asset>;

function parse(context: DirectoryContext): ParsedGuardianPhoneFactorSettings {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return { guardianPhoneFactorSettings: null }; // Skip

  const file = path.join(guardianFolder, 'phoneFactorSettings.json');

  if (!isFile(file)) {
    return { guardianPhoneFactorSettings: null };
  }

  return {
    guardianPhoneFactorSettings: loadJSON(file, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianPhoneFactorSettings } = context.assets;

  if (!guardianPhoneFactorSettings) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'phoneFactorSettings.json');
  dumpJSON(file, guardianPhoneFactorSettings);
}

const guardianPhoneFactorSettingsHandler: DirectoryHandler<ParsedGuardianPhoneFactorSettings> = {
  parse,
  dump,
};

export default guardianPhoneFactorSettingsHandler;
