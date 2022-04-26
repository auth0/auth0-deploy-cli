import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedLogStreams = ParsedAsset<'logStreams', Asset[]>;

async function parseAndDump(context: YAMLContext): Promise<ParsedLogStreams> {
  const { logStreams } = context.assets;

  if (!logStreams) return { logStreams: null };

  return {
    logStreams,
  };
}

const logStreamsHandler: YAMLHandler<ParsedLogStreams> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default logStreamsHandler;
