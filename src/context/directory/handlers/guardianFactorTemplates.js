import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';

function parse(context) {
  const factorTemplatesFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(factorTemplatesFolder)) return { guardianFactorTemplates: undefined }; // Skip

  const foundFiles = getFiles(factorTemplatesFolder, [ '.json' ]);

  const guardianFactorTemplates = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty guardianFactorTemplates

  return {
    guardianFactorTemplates
  };
}


async function dump(context) {
  const { guardianFactorTemplates } = context.assets;

  if (!guardianFactorTemplates) return; // Skip, nothing to dump

  const factorTemplatesFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(factorTemplatesFolder);

  guardianFactorTemplates.forEach((factorTemplates) => {
    const factorTemplatesFile = path.join(factorTemplatesFolder, `${factorTemplates.name}.json`);
    log.info(`Writing ${factorTemplatesFile}`);
    fs.writeFileSync(factorTemplatesFile, JSON.stringify(factorTemplates, null, 2));
  });
}


export default {
  parse,
  dump
};
