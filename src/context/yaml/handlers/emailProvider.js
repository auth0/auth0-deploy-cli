
async function parse(context) {
  // nothing to do, set default if empty
  return { emailProvider: context.assets.emailProvider || {} };
}

async function dump(mgmtClient) {
  const emailProvider = await mgmtClient.emailProvider.get();
  return { emailProvider };
}


export default {
  parse,
  dump
};
