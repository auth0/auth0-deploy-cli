async function parse(context) {
  // nothing to do, set default if empty
  return {
    guardianFactors: [ ...context.assets.guardianFactors || [] ]
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    guardianFactors: [ ...context.assets.guardianFactors || [] ]
  };
}

export default {
  parse,
  dump
};
