import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';

function parse(context) {
  const factorsFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_FACTORS_DIRECTORY);
  if (!existsMustBeDir(factorsFolder)) return { guardianFactors: undefined }; // Skip

  const foundFiles = getFiles(factorsFolder, [ '.json' ]);

  const guardianFactors = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty guardianFactors

  return {
    guardianFactors
  };
}


async function dump(context) {
  const { guardianFactors } = context.assets;

  if (!guardianFactors) return; // Skip, nothing to dump

  const factorsFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_FACTORS_DIRECTORY);
  fs.ensureDirSync(factorsFolder);

  guardianFactors.forEach((factor) => {
    const factorFile = path.join(factorsFolder, `${factor.name}.json`);
    dumpJSON(factorFile, factor);
  });
}


export default {
  parse,
  dump
};
