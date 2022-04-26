import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedResourceServers = {
  resourceServers: Asset[] | null;
};

async function parse(context: YAMLContext): Promise<ParsedResourceServers> {
  const { resourceServers } = context.assets;

  if (!resourceServers) {
    return { resourceServers: null };
  }
  return {
    resourceServers,
  };
}

async function dump(context: YAMLContext): Promise<ParsedResourceServers> {
  // nothing to do, set default if empty
  return {
    resourceServers: [...(context.assets.resourceServers || [])],
  };
}

const resourceServersHandler: YAMLHandler<ParsedResourceServers> = {
  parse,
  dump,
};

export default resourceServersHandler;
