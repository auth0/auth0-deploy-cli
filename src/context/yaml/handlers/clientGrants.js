
async function parse() {
  // nothing to do
  return {};
}

async function dump(mgmtClient) {
  const clientGrants = await mgmtClient.clientGrants.getAll({ paginate: true });
  return { clientGrants };
}


export default {
  parse,
  dump
};
