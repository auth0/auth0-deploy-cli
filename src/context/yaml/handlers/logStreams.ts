import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { logStreamDefaults } from '../../defaults';

type ParsedLogStreams = ParsedAsset<'logStreams', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedLogStreams> {
  const { logStreams } = context.assets;

  if (!logStreams) return { logStreams: null };

  return {
    logStreams,
  };
}

async function dump(context: YAMLContext): Promise<ParsedLogStreams> {
  const { logStreams } = context.assets;

  if (!logStreams) return { logStreams: null };

  // masked sensitive fields
  const maskedLogStreams = logStreamDefaults(logStreams);

  return {
    logStreams: maskedLogStreams,
  };
}

const logStreamsHandler: YAMLHandler<ParsedLogStreams> = {
  parse: parse,
  dump: dump,
};

export default logStreamsHandler;
