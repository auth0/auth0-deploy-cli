import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { existsMustBeDir, loadJSON, isFile } from '../../../utils';

function parse(context) {
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


async function dump(context) {
  const { guardianPhoneFactorSelectedProvider } = context.assets;

  if (!guardianPhoneFactorSelectedProvider) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'phoneFactorSelectedProvider.json');
  log.info(`Writing ${file}`);
  fs.writeFileSync(file, JSON.stringify(guardianPhoneFactorSelectedProvider, null, 2));
}


export default {
  parse,
  dump
};
