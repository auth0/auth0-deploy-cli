
async function parse(context) {
  // nothing to do, set default if empty
  return {
    rulesConfigs: [ ...context.assets.rulesConfigs || [] ]
  };
}

async function dump(context) {
  const rulesConfigs = context.assets.rulesConfigs || [];
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
