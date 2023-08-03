import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';

import { getFiles, existsMustBeDir, dumpJSON, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedGuardianFactors = ParsedAsset<'guardianFactors', Asset[]>;

function parse(context: DirectoryContext): ParsedGuardianFactors {
  const factorsFolder = path.join(
    context.filePath,
    constants.GUARDIAN_DIRECTORY,
    constants.GUARDIAN_FACTORS_DIRECTORY
  );
  if (!existsMustBeDir(factorsFolder)) return { guardianFactors: null }; // Skip

  const foundFiles = getFiles(factorsFolder, ['.json']);

  const guardianFactors = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty guardianFactors

  return {
    guardianFactors,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { guardianFactors } = context.assets;

  if (!guardianFactors) return; // Skip, nothing to dump

  const factorsFolder = path.join(
    context.filePath,
    constants.GUARDIAN_DIRECTORY,
    constants.GUARDIAN_FACTORS_DIRECTORY
  );
  fs.ensureDirSync(factorsFolder);

  guardianFactors.forEach((factor) => {
    const factorFile = path.join(factorsFolder, `${factor.name}.json`);
    dumpJSON(factorFile, factor);
  });
}

const guardianFactorsHandler: DirectoryHandler<ParsedGuardianFactors> = {
  parse,
  dump,
};

export default guardianFactorsHandler;
