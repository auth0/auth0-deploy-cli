import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';
import { existsMustBeDir, dumpJSON, loadJSON, isFile } from '../../../utils';

function parse(context) {
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


async function dump(context) {
  const { guardianPhoneFactorMessageTypes } = context.assets;

  if (!guardianPhoneFactorMessageTypes) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'phoneFactorMessageTypes.json');
  dumpJSON(file, guardianPhoneFactorMessageTypes);
}


export default {
  parse,
  dump
};
