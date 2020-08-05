async function parse(context) {
  throw new Error('Not Implemented' + context);
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
