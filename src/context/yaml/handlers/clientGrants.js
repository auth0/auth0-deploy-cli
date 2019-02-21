
async function parse(context) {
  // nothing to do, set default empty
  return {
    clientGrants: context.assets.clientGrants
  };
}

async function dump(context) {
  const { clientGrants } = context.assets;

  // Nothing to do
  if (!clientGrants) return {};

  const clients = context.assets.clients || [];

  // Convert client_id to the client name for readability
  return {
    clientGrants: clientGrants.map((grant) => {
      const dumpGrant = { ...grant };
      const found = clients.find(c => c.client_id === dumpGrant.client_id);
      if (found) dumpGrant.client_id = found.name;
      return dumpGrant;
    })
  };
}


export default {
  parse,
  dump
};
