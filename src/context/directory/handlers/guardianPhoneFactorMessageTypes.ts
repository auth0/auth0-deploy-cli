import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import {
  existsMustBeDir, dumpJSON, loadJSON, isFile
} from '../../../utils';
import { DirectoryHandler } from '.'

type ParsedGuardianFactorMessageTypes = {
  guardianPhoneFactorMessageTypes: unknown
} | {}

function parse(context): ParsedGuardianFactorMessageTypes {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return {}; // Skip

  const file = path.join(guardianFolder, 'phoneFactorMessageTypes.json');

  if (isFile(file)) {
    return {
      guardianPhoneFactorMessageTypes: loadJSON(file, context.mappings)
    };
  }

  return {};
}

async function dump(context): Promise<void> {
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
}

export default guardianFactorMessageTypesHandler;