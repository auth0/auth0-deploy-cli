import { ResourceServer } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';

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
