import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { eventStreamDefaults } from '../../defaults';

type ParsedEventStreams = ParsedAsset<'eventStreams', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedEventStreams> {
  const { eventStreams } = context.assets;

  if (!eventStreams) return { eventStreams: null };

  return {
    eventStreams,
  };
}

async function dump(context: YAMLContext): Promise<ParsedEventStreams> {
  const { eventStreams } = context.assets;

  if (!eventStreams) return { eventStreams: null };

  return {
    eventStreams: eventStreamDefaults(eventStreams, context.config),
  };
}

const eventStreamsHandler: YAMLHandler<ParsedEventStreams> = {
  parse,
  dump,
};

export default eventStreamsHandler;
