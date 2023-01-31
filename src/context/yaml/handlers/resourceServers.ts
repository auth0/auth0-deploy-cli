import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { ResourceServer } from '../../../tools/auth0/handlers/resourceServers';

type ParsedResourceServers = ParsedAsset<'resourceServers', ResourceServer[]>;

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
