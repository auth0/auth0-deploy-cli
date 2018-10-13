
async function parse() {
  // nothing to do
  return {};
}

async function dump(mgmtClient) {
  const clients = await mgmtClient.getClients({ paginate: true, is_global: false });
  return { clients };
}


export default {
  parse,
  dump
};
