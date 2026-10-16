import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedExperiments = ParsedAsset<'experiments', Asset[]>;

function parse(context: DirectoryContext): ParsedExperiments {
  const experimentsDirectory = path.join(context.filePath, constants.EXPERIMENTS_DIRECTORY);
  if (!existsMustBeDir(experimentsDirectory)) return { experiments: null };

  const foundFiles = getFiles(experimentsDirectory, ['.json']);

  const experiments = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0);

  return {
    experiments,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { experiments } = context.assets;

  if (!experiments) return;

  const experimentsDirectory = path.join(context.filePath, constants.EXPERIMENTS_DIRECTORY);

  fs.ensureDirSync(experimentsDirectory);

  const expectedFiles = new Set<string>();

  experiments.forEach((experiment) => {
    const fileName = `${sanitize(experiment.name)}.json`;
    const experimentFile = path.join(experimentsDirectory, fileName);
    dumpJSON(experimentFile, experiment);
    expectedFiles.add(fileName);
  });

  // Remove files for experiments no longer present in the tenant
  for (const existing of fs.readdirSync(experimentsDirectory)) {
    const fullPath = path.join(experimentsDirectory, existing);
    if (fs.statSync(fullPath).isFile() && !expectedFiles.has(existing)) {
      fs.removeSync(fullPath);
    }
  }
}

const experimentsHandler: DirectoryHandler<ParsedExperiments> = {
  parse,
  dump,
};

export default experimentsHandler;
