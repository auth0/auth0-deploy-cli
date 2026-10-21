import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedFeatureFlags = ParsedAsset<'featureFlags', Asset[]>;

function parse(context: DirectoryContext): ParsedFeatureFlags {
  const featureFlagsDirectory = path.join(context.filePath, constants.FEATURE_FLAGS_DIRECTORY);
  if (!existsMustBeDir(featureFlagsDirectory)) return { featureFlags: null };

  const foundFiles = getFiles(featureFlagsDirectory, ['.json']);

  const featureFlags = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0);

  return {
    featureFlags,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { featureFlags } = context.assets;

  if (!featureFlags) return;

  const featureFlagsDirectory = path.join(context.filePath, constants.FEATURE_FLAGS_DIRECTORY);

  fs.ensureDirSync(featureFlagsDirectory);

  const expectedFiles = new Set<string>();

  featureFlags.forEach((featureFlag) => {
    const fileName = `${sanitize(featureFlag.name)}.json`;
    const featureFlagFile = path.join(featureFlagsDirectory, fileName);
    dumpJSON(featureFlagFile, featureFlag);
    expectedFiles.add(fileName);
  });

  // Remove files for feature flags no longer present in the tenant
  for (const existing of fs.readdirSync(featureFlagsDirectory)) {
    const fullPath = path.join(featureFlagsDirectory, existing);
    if (fs.statSync(fullPath).isFile() && !expectedFiles.has(existing)) {
      fs.removeSync(fullPath);
    }
  }
}

const featureFlagsHandler: DirectoryHandler<ParsedFeatureFlags> = {
  parse,
  dump,
};

export default featureFlagsHandler;
