import { constants } from 'auth0-source-control-extension-tools';

async function parse() {
  // nothing to do
  return {};
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
