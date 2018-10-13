async function parse(context) {
  // nothing to do, set default if empty
  return { connections: context.assets.connections || [] };
}

async function dump(mgmtClient) {
  const connections = await mgmtClient.connections.getAll({ paginate: true });
  // Filter out database connections
  return {
    connections: connections.filter(c => c.strategy !== 'auth0')
  };
}


export default {
  parse,
  dump
};
