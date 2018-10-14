
async function parse(context) {
  // nothing to do, set default if empty
  return { emailProvider: context.assets.emailProvider || {} };
}

async function dump(context) {
  // nothing to do, set default if empty
  return { emailProvider: context.assets.emailProvider || {} };
}


export default {
  parse,
  dump
};
