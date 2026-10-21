import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import {
  getFiles,
  existsMustBeDir,
  isDirectory,
  isFile,
  dumpJSON,
  loadJSON,
  sanitize,
} from '../../../utils';
import log from '../../../logger';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedVariations = ParsedAsset<'variations', Asset[]>;

function parse(context: DirectoryContext): ParsedVariations {
  const variationsDirectory = path.join(context.filePath, constants.VARIATIONS_DIRECTORY);
  if (!existsMustBeDir(variationsDirectory)) return { variations: null };

  const entries = fs
    .readdirSync(variationsDirectory)
    .map((entry) => path.join(variationsDirectory, entry));

  // Variations are stored one subfolder per flag (variations/<flag>/<variation>.json). Warn about
  // any .json sitting directly under variations/, which is the old flat layout: it would be
  // skipped here, and silently reading it as "no variations" could delete tenant variations when
  // AUTH0_ALLOW_DELETE is on.
  const flatFiles = entries.filter((entry) => isFile(entry) && path.extname(entry) === '.json');
  if (flatFiles.length > 0) {
    log.warn(
      `Ignoring ${flatFiles.length} variation file(s) directly under ${constants.VARIATIONS_DIRECTORY}/. Variations are now stored per flag as ${constants.VARIATIONS_DIRECTORY}/<flag>/<variation>.json; move these files into their flag's subfolder.`
    );
  }

  // Walk each flag subfolder and collect its variation files.
  const flagFolders = entries.filter((entry) => isDirectory(entry));

  const variations = flagFolders
    .flatMap((folder) => getFiles(folder, ['.json']))
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

  // Store each variation under a per-flag subfolder. A variation name is unique only within its
  // flag, and both the flag name and the variation name can contain the sanitizer's separator, so
  // a flat "<flag>-<variation>.json" scheme can collide (e.g. flag "a-b" + "c" vs flag "a" +
  // "b-c"). The subfolder keeps the flag boundary unambiguous.
  const expectedByFlag = new Map<string, Set<string>>();

  variations.forEach((variation) => {
    const flagFolderName = sanitize(variation.feature_flag_name);
    const flagFolder = path.join(variationsDirectory, flagFolderName);
    fs.ensureDirSync(flagFolder);

    const fileName = `${sanitize(variation.name)}.json`;
    dumpJSON(path.join(flagFolder, fileName), variation);

    if (!expectedByFlag.has(flagFolderName)) expectedByFlag.set(flagFolderName, new Set());
    expectedByFlag.get(flagFolderName)!.add(fileName);
  });

  // Remove flag subfolders and variation files no longer present in the tenant.
  for (const entry of fs.readdirSync(variationsDirectory)) {
    const flagFolder = path.join(variationsDirectory, entry);
    if (!isDirectory(flagFolder)) continue;

    const expectedFiles = expectedByFlag.get(entry);
    if (!expectedFiles) {
      fs.removeSync(flagFolder);
      continue;
    }
    for (const file of fs.readdirSync(flagFolder)) {
      if (!expectedFiles.has(file)) {
        fs.removeSync(path.join(flagFolder, file));
      }
    }
  }
}

const variationsHandler: DirectoryHandler<ParsedVariations> = {
  parse,
  dump,
};

export default variationsHandler;
