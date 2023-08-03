import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianFactorMessageTypes = ParsedAsset<'guardianPhoneFactorMessageTypes', Asset>;

function parse(context: DirectoryContext): ParsedGuardianFactorMessageTypes {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return { guardianPhoneFactorMessageTypes: null }; // Skip

  const file = path.join(guardianFolder, 'phoneFactorMessageTypes.json');

  if (!isFile(file)) {
    return { guardianPhoneFactorMessageTypes: null };
  }

  return {
    guardianPhoneFactorMessageTypes: loadJSON(file, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianPhoneFactorMessageTypes } = context.assets;

  if (!guardianPhoneFactorMessageTypes) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'phoneFactorMessageTypes.json');
  dumpJSON(file, guardianPhoneFactorMessageTypes);
}

const guardianFactorMessageTypesHandler: DirectoryHandler<ParsedGuardianFactorMessageTypes> = {
  parse,
  dump,
};

export default guardianFactorMessageTypesHandler;
