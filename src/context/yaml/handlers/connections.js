async function parse() {
  // nothing to do
  return {};
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
