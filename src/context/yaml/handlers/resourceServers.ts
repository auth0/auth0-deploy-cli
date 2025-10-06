import { Client, ResourceServer } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { paginate } from '../../../tools/auth0/client';
import { convertClientIdToName } from '../../../utils';

type ParsedResourceServers = ParsedAsset<'resourceServers', ResourceServer[]>;

async function dumpAndParse(context: YAMLContext): Promise<ParsedResourceServers> {
  const { resourceServers } = context.assets;
  let { clients } = context.assets;

  if (!resourceServers) {
    return { resourceServers: null };
  }

  if (clients === undefined) {
    clients = await paginate<Client>(context.mgmtClient.clients.getAll, {
      paginate: true,
      include_totals: true,
    });
  }

  return {
    resourceServers: resourceServers.map((rs) => {
      const dumpResourceServer = { ...rs };
      if (dumpResourceServer.client_id) {
        dumpResourceServer.client_id = convertClientIdToName(
          dumpResourceServer.client_id,
          clients || []
        );
      }
      return dumpResourceServer;
    }),
  };
}

const resourceServersHandler: YAMLHandler<ParsedResourceServers> = {
  parse: dumpAndParse,
  dump: dumpAndParse,
};

export default resourceServersHandler;
