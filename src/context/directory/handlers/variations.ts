import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedVariations = ParsedAsset<'variations', Asset[]>;

function parse(context: DirectoryContext): ParsedVariations {
  const variationsDirectory = path.join(context.filePath, constants.VARIATIONS_DIRECTORY);
  if (!existsMustBeDir(variationsDirectory)) return { variations: null };

  const foundFiles = getFiles(variationsDirectory, ['.json']);

  const variations = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0);

  return {
    variations,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { variations } = context.assets;

  if (!variations) return;

  const variationsDirectory = path.join(context.filePath, constants.VARIATIONS_DIRECTORY);

  fs.ensureDirSync(variationsDirectory);

  const expectedFiles = new Set<string>();

  variations.forEach((variation) => {
    // Variation names are unique only within a flag, so the file name is scoped by the flag.
    const fileName = `${sanitize(variation.feature_flag_name)}-${sanitize(variation.name)}.json`;
    const variationFile = path.join(variationsDirectory, fileName);
    dumpJSON(variationFile, variation);
    expectedFiles.add(fileName);
  });

  // Remove files for variations no longer present in the tenant
  for (const existing of fs.readdirSync(variationsDirectory)) {
    const fullPath = path.join(variationsDirectory, existing);
    if (fs.statSync(fullPath).isFile() && !expectedFiles.has(existing)) {
      fs.removeSync(fullPath);
    }
  }
}

const variationsHandler: DirectoryHandler<ParsedVariations> = {
  parse,
  dump,
};

export default variationsHandler;
