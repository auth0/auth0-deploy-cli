import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedLogStreams = ParsedAsset<'logStreams', Asset[]>;

function parse(context: DirectoryContext): ParsedLogStreams {
  const logStreamsDirectory = path.join(context.filePath, constants.LOG_STREAMS_DIRECTORY);
  if (!existsMustBeDir(logStreamsDirectory)) return { logStreams: null }; // Skip

  const foundFiles = getFiles(logStreamsDirectory, ['.json']);

  const logStreams = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty rulesConfigs

  return {
    logStreams,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const logStreams = context.assets.logStreams;

  if (!logStreams) return; // Skip, nothing to dump

  // Create Rules folder
  const logStreamsDirectory = path.join(context.filePath, constants.LOG_STREAMS_DIRECTORY);
  fs.ensureDirSync(logStreamsDirectory);
  logStreams.forEach((logStream) => {
    const ruleFile = path.join(logStreamsDirectory, `${sanitize(logStream.name)}.json`);
    dumpJSON(ruleFile, logStream);
  });
}

const logStreamsHandler: DirectoryHandler<ParsedLogStreams> = {
  parse,
  dump,
};

export default logStreamsHandler;
