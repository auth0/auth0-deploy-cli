async function parse(context) {
  // nothing to do, set default if empty
  return {
    rulesConfigs: context.assets.rulesConfigs
  };
}

async function dump() {
  // do not export rulesConfigs as its values cannot be extracted
  return {
    rulesConfigs: []
  };
}

export default {
  parse,
  dump
};
