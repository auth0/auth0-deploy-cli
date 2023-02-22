import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianFactorSelectedProvider = ParsedAsset<
  'guardianPhoneFactorSelectedProvider',
  Asset
>;

function parse(context: DirectoryContext): ParsedGuardianFactorSelectedProvider {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return { guardianPhoneFactorSelectedProvider: null }; // Skip

  const file = path.join(guardianFolder, 'phoneFactorSelectedProvider.json');

  if (!isFile(file)) {
    return { guardianPhoneFactorSelectedProvider: null };
  }

  return {
    guardianPhoneFactorSelectedProvider: loadJSON(file, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    }),
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianPhoneFactorSelectedProvider } = context.assets;

  if (!guardianPhoneFactorSelectedProvider) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'phoneFactorSelectedProvider.json');
  dumpJSON(file, guardianPhoneFactorSelectedProvider);
}

const guardianFactorSelectedProviderHandler: DirectoryHandler<ParsedGuardianFactorSelectedProvider> =
  {
    parse,
    dump,
  };

export default guardianFactorSelectedProviderHandler;
