import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { existsMustBeDir, loadJSON, isFile } from '../../../utils';

function parse(context) {
  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  if (!existsMustBeDir(guardianFolder)) return {}; // Skip

  const file = path.join(guardianFolder, 'policies.json');

  if (isFile(file)) {
    return {
      guardianPolicies: loadJSON(file, context.mappings)
    };
  }

  return {};
}


async function dump(context) {
  const { guardianPolicies } = context.assets;

  if (!guardianPolicies) return; // Skip, nothing to dump

  const guardianFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY);
  fs.ensureDirSync(guardianFolder);

  const file = path.join(guardianFolder, 'policies.json');
  log.info(`Writing ${file}`);
  fs.writeFileSync(file, JSON.stringify(guardianPolicies, null, 2));
}


export default {
  parse,
  dump
};
