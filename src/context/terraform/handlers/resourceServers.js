async function dump(context) {
  // nothing to do, set default if empty
  return (context.assets.resourceServers || []).map(resourceServer => ({
    type: 'auth0_resource_server',
    name: resourceServer.name,
    content: resourceServer
  }));
}

export default {
  dump
};
