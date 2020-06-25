async function parse(context) {
  // nothing to do, set default if empty
  return {
    guardianPhoneFactorSelectedProvider: { ...context.assets.guardianPhoneFactorSelectedProvider || {} }
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    guardianPhoneFactorSelectedProvider: { ...context.assets.guardianPhoneFactorSelectedProvider || {} }
  };
}


export default {
  parse,
  dump
};
