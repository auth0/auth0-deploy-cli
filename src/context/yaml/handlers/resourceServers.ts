import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedResourceServers = {
  resourceServers: Asset[] | null;
};

async function dumpAndParse(context: YAMLContext): Promise<ParsedResourceServers> {
  const { resourceServers } = context.assets;

  if (!resourceServers) {
    return { resourceServers: null };
  }
  return {
    resourceServers,
  };
}

const resourceServersHandler: YAMLHandler<ParsedResourceServers> = {
  parse: dumpAndParse,
  dump: dumpAndParse,
};

export default resourceServersHandler;
