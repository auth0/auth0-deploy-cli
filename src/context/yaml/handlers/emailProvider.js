
async function parse() {
  // nothing to do
  return {};
}

async function dump(mgmtClient) {
  const emailProvider = await mgmtClient.emailProvider.get();
  return { emailProvider };
}


export default {
  parse,
  dump
};
