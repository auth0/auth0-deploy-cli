
async function parse() {
  // nothing to do
  return {};
}

async function dump(mgmtClient) {
  const rulesConfigs = await mgmtClient.rulesConfigs.getAll({ paginate: true });
  return {
    rulesConfigs: rulesConfigs.map(r => ({
      ...r,
      value: '*******'
    }))
  };
}


export default {
  parse,
  dump
};
