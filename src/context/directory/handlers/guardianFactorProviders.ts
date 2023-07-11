import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianFactorProviders = ParsedAsset<'guardianFactorProviders', Asset[]>;

function parse(context: DirectoryContext): ParsedGuardianFactorProviders {
  const factorProvidersFolder = path.join(
    context.filePath,
    constants.GUARDIAN_DIRECTORY,
    constants.GUARDIAN_PROVIDERS_DIRECTORY
  );
  if (!existsMustBeDir(factorProvidersFolder)) return { guardianFactorProviders: null }; // Skip

  const foundFiles = getFiles(factorProvidersFolder, ['.json']);

  const guardianFactorProviders = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty factorProvidersFolder

  return {
    guardianFactorProviders,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianFactorProviders } = context.assets;

  if (!guardianFactorProviders) return; // Skip, nothing to dump

  const factorProvidersFolder = path.join(
    context.filePath,
    constants.GUARDIAN_DIRECTORY,
    constants.GUARDIAN_PROVIDERS_DIRECTORY
  );
  fs.ensureDirSync(factorProvidersFolder);

  guardianFactorProviders.forEach((factorProvider) => {
    const factorProviderFile = path.join(
      factorProvidersFolder,
      `${factorProvider.name}-${factorProvider.provider}.json`
    );
    dumpJSON(factorProviderFile, factorProvider);
  });
}

const guardianFactorProvidersHandler: DirectoryHandler<ParsedGuardianFactorProviders> = {
  parse,
  dump,
};

export default guardianFactorProvidersHandler;
