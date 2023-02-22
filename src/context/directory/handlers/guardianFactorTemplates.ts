import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianFactorTemplates = ParsedAsset<'guardianFactorTemplates', Asset[]>;

function parse(context: DirectoryContext): ParsedGuardianFactorTemplates {
  const factorTemplatesFolder = path.join(
    context.filePath,
    constants.GUARDIAN_DIRECTORY,
    constants.GUARDIAN_TEMPLATES_DIRECTORY
  );
  if (!existsMustBeDir(factorTemplatesFolder)) return { guardianFactorTemplates: null }; // Skip

  const foundFiles = getFiles(factorTemplatesFolder, ['.json']);

  const guardianFactorTemplates = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty guardianFactorTemplates

  return {
    guardianFactorTemplates,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianFactorTemplates } = context.assets;

  if (!guardianFactorTemplates) return; // Skip, nothing to dump

  const factorTemplatesFolder = path.join(
    context.filePath,
    constants.GUARDIAN_DIRECTORY,
    constants.GUARDIAN_TEMPLATES_DIRECTORY
  );
  fs.ensureDirSync(factorTemplatesFolder);

  guardianFactorTemplates.forEach((factorTemplates) => {
    const factorTemplatesFile = path.join(factorTemplatesFolder, `${factorTemplates.name}.json`);
    dumpJSON(factorTemplatesFile, factorTemplates);
  });
}

const guardianFactorTemplatesHandler: DirectoryHandler<ParsedGuardianFactorTemplates> = {
  parse,
  dump,
};

export default guardianFactorTemplatesHandler;
