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

  maskedEventStreams.forEach((eventStream) => {
    const streamFile = path.join(eventStreamsDirectory, `${sanitize(eventStream.name)}.json`);
    dumpJSON(streamFile, eventStream);
  });
}

const eventStreamsHandler: DirectoryHandler<ParsedEventStreams> = {
  parse,
  dump,
};

export default eventStreamsHandler;
