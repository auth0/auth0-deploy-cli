import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedResourceServers = ParsedAsset<'resourceServers', Asset[]>;

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
