import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import {
  existsMustBeDir, dumpJSON, loadJSON, isFile
} from '../../../utils';
import { DirectoryHandler } from '.'
import DirectoryContext from '..'

type ParsedGuardianFactorSelectedProvider = {
  guardianPhoneFactorSelectedProvider: unknown
} | {}

function parse(context: DirectoryContext): ParsedGuardianFactorSelectedProvider {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return {}; // Skip

  const file = path.join(guardianFolder, 'phoneFactorSelectedProvider.json');

  if (isFile(file)) {
    return {
      guardianPhoneFactorSelectedProvider: loadJSON(file, context.mappings)
    };
  }

  return {};
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianPhoneFactorSelectedProvider } = context.assets;

  if (!guardianPhoneFactorSelectedProvider) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'phoneFactorSelectedProvider.json');
  dumpJSON(file, guardianPhoneFactorSelectedProvider);
}


const guardianFactorSelectedProviderHandler: DirectoryHandler<ParsedGuardianFactorSelectedProvider> = {
  parse,
  dump,
}

export default guardianFactorSelectedProviderHandler;