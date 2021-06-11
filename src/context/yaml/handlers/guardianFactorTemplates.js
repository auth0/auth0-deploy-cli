async function parse(context) {
  // nothing to do, set default if empty
  return {
    guardianFactorTemplates: [ ...context.assets.guardianFactorTemplates || [] ]
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    guardianFactorTemplates: [ ...context.assets.guardianFactorTemplates || [] ]
  };
}

export default {
  parse,
  dump
};
