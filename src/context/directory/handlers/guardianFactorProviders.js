import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';

function parse(context) {
  const factorProvidersFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_PROVIDERS_DIRECTORY);
  if (!existsMustBeDir(factorProvidersFolder)) return { guardianFactorProviders: undefined }; // Skip

  const foundFiles = getFiles(factorProvidersFolder, [ '.json' ]);

  const guardianFactorProviders = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty factorProvidersFolder

  return {
    guardianFactorProviders
  };
}


async function dump(context) {
  const { guardianFactorProviders } = context.assets;

  if (!guardianFactorProviders) return; // Skip, nothing to dump

  const factorProvidersFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_PROVIDERS_DIRECTORY);
  fs.ensureDirSync(factorProvidersFolder);

  guardianFactorProviders.forEach((factorProvider) => {
    const factorProviderFile = path.join(factorProvidersFolder, `${factorProvider.name}-${factorProvider.provider}.json`);
    log.info(`Writing ${factorProviderFile}`);
    fs.writeFileSync(factorProviderFile, JSON.stringify(factorProvider, null, 2));
  });
}


export default {
  parse,
  dump
};
