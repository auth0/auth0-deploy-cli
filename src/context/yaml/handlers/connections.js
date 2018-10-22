async function parse(context) {
  // nothing to do, set default if empty
  return {
    connections: [ ...context.assets.connections || [] ]
  };
}

async function dump(context) {
  const { connections } = context.assets;

  // Nothing to do
  if (!connections) return {};

  const clients = context.assets.clients || [];

  // nothing to do, set default if empty
  return {
    connections: connections.map(connection => ({
      ...connection,
      enabled_clients: [
        ...(connection.enabled_clients || []).map((clientId) => {
          const found = clients.find(c => c.client_id === clientId);
          if (found) return found.name;
          return clientId;
        })
      ]
    }))
  };
}


export default {
  parse,
  dump
};
