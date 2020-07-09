async function parse(context) {
  // nothing to do, set default if empty
  return {
    guardianPhoneFactorMessageTypes: { ...context.assets.guardianPhoneFactorMessageTypes || {} }
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    guardianPhoneFactorMessageTypes: { ...context.assets.guardianPhoneFactorMessageTypes || {} }
  };
}


export default {
  parse,
  dump
};
