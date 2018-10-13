
async function parse(context) {
  // nothing to do, set default if empty
  return { rulesConfigs: context.assets.rulesConfigs || [] };
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
