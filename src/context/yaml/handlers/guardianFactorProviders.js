async function parse(context) {
  // nothing to do, set default if empty
  return {
    guardianFactorProviders: [ ...context.assets.guardianFactorProviders || [] ]
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    guardianFactorProviders: [ ...context.assets.guardianFactorProviders || [] ]
  };
}


export default {
  parse,
  dump
};
