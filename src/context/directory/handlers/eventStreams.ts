import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { eventStreamDefaults } from '../../defaults';

type ParsedEventStreams = ParsedAsset<'eventStreams', Asset[]>;

function parse(context: DirectoryContext): ParsedEventStreams {
  const eventStreamsDirectory = path.join(context.filePath, constants.EVENT_STREAMS_DIRECTORY);
  if (!existsMustBeDir(eventStreamsDirectory)) return { eventStreams: null };

  const foundFiles = getFiles(eventStreamsDirectory, ['.json']);

  const eventStreams = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0);

  return {
    eventStreams,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { eventStreams } = context.assets;

  if (!eventStreams) return;

  const eventStreamsDirectory = path.join(context.filePath, constants.EVENT_STREAMS_DIRECTORY);

  fs.ensureDirSync(eventStreamsDirectory);

  const maskedEventStreams = eventStreamDefaults(eventStreams, context.config);

  const expectedFiles = new Set<string>();

  maskedEventStreams.forEach((eventStream) => {
    const fileName = `${sanitize(eventStream.name)}.json`;
    const streamFile = path.join(eventStreamsDirectory, fileName);
    dumpJSON(streamFile, eventStream);
    expectedFiles.add(fileName);
  });

  // Remove files for event streams no longer present in the tenant
  for (const existing of fs.readdirSync(eventStreamsDirectory)) {
    const fullPath = path.join(eventStreamsDirectory, existing);
    if (fs.statSync(fullPath).isFile() && !expectedFiles.has(existing)) {
      fs.removeSync(fullPath);
    }
  }
}

const eventStreamsHandler: DirectoryHandler<ParsedEventStreams> = {
  parse,
  dump,
};

export default eventStreamsHandler;
