import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedLogStreams = {
  logStreams: Asset[] | null;
};

async function parseAndDump(context: YAMLContext): Promise<ParsedLogStreams> {
  return {
    logStreams: context.assets.logStreams || [],
  };
}

const logStreamsHandler: YAMLHandler<ParsedLogStreams> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default logStreamsHandler;
