async function parse(context) {
  // nothing to do, set default if empty
  return {
    guardianPolicies: { ...context.assets.guardianPolicies || {} }
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    guardianPolicies: { ...context.assets.guardianPolicies || {} }
  };
}


export default {
  parse,
  dump
};
