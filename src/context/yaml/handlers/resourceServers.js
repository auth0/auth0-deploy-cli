import { constants } from 'auth0-source-control-extension-tools';

async function parse(context) {
  // nothing to do, set default if empty
  return { resourceServers: context.assets.resourceServers || [] };
}

async function dump(mgmtClient) {
  const resourceServers = await mgmtClient.resourceServers.getAll({ paginate: true });
  return {
    resourceServers: resourceServers.filter(rs => rs.name !== constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME)
  };
}


export default {
  parse,
  dump
};
