import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import {
  getFiles, existsMustBeDir, dumpJSON, loadJSON
} from '../../../utils';
import { DirectoryHandler, Context } from '.'

type ParsedGuardianFactorTemplates = {
  guardianFactorTemplates: unknown[] | undefined
}

function parse(context: Context): ParsedGuardianFactorTemplates {
  const factorTemplatesFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_TEMPLATES_DIRECTORY);
  if (!existsMustBeDir(factorTemplatesFolder)) return { guardianFactorTemplates: undefined }; // Skip

  const foundFiles = getFiles(factorTemplatesFolder, ['.json']);

  const guardianFactorTemplates = foundFiles.map((f) => loadJSON(f, context.mappings))
    .filter((p) => Object.keys(p).length > 0); // Filter out empty guardianFactorTemplates

  return {
    guardianFactorTemplates
  };
}

async function dump(context: Context): Promise<void> {
  const { guardianFactorTemplates } = context.assets;

  if (!guardianFactorTemplates) return; // Skip, nothing to dump

  const factorTemplatesFolder = path.join(context.filePath, constants.GUARDIAN_DIRECTORY, constants.GUARDIAN_TEMPLATES_DIRECTORY);
  fs.ensureDirSync(factorTemplatesFolder);

  guardianFactorTemplates.forEach((factorTemplates) => {
    const factorTemplatesFile = path.join(factorTemplatesFolder, `${factorTemplates.name}.json`);
    dumpJSON(factorTemplatesFile, factorTemplates);
  });
}

const guardianFactorTemplatesHandler: DirectoryHandler<ParsedGuardianFactorTemplates> = {
  parse,
  dump,
}

export default guardianFactorTemplatesHandler;