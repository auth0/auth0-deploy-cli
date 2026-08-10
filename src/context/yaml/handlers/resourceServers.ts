import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { paginate } from '../../../tools/auth0/client';
import { convertClientIdToName } from '../../../utils';
import { ResourceServer } from '../../../tools/auth0/handlers/resourceServers';
import { Client } from '../../../tools/auth0/handlers/clients';

type ParsedResourceServers = ParsedAsset<'resourceServers', ResourceServer[]>;

async function parse(context: YAMLContext): Promise<ParsedResourceServers> {
  const { resourceServers } = context.assets;
  let { clients } = context.assets;

  if (!resourceServers) {
    return { resourceServers: null };
  }

  if (clients === undefined) {
    clients = await paginate<Client>(context.mgmtClient.clients.list, {
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

async function dump(context: YAMLContext): Promise<ParsedResourceServers> {
  let { resourceServers } = context.assets;
  let { clients } = context.assets;

  if (!resourceServers) {
    return { resourceServers: null };
  }

  // Filter excluded resource servers
  const excludedResourceServers =
    (context.assets.exclude && context.assets.exclude.resourceServers) || [];
  if (excludedResourceServers.length) {
    resourceServers = resourceServers.filter(
      (rs) => !excludedResourceServers.includes(rs.name ?? '')
    );
  }

  if (clients === undefined) {
    clients = await paginate<Client>(context.mgmtClient.clients.list, {
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
  parse,
  dump,
};

export default resourceServersHandler;
