async function parse(context) {
  // nothing to do, set default if empty
  return { tenant: context.assets.tenant || {} };
}

async function dump(context) {
  // nothing to do, set default if empty
  return { tenant: context.assets.tenant || {} };
}


export default {
  parse,
  dump
};
