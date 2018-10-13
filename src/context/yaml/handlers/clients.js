
async function parse(context) {
  // nothing to do, set default empty
  return { clients: context.assets.clients || [] };
}

async function dump(mgmtClient) {
  const clients = await mgmtClient.getClients({ paginate: true, is_global: false });
  return { clients };
}


export default {
  parse,
  dump
};
