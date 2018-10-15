
async function parse(context) {
  // nothing to do, set default empty
  return {
    clientGrants: [ ...context.assets.clientGrants || [] ]
  };
}

async function dump(context) {
  // Nothing to do
  return {
    clientGrants: [ ...context.assets.clientGrants || [] ]
  };
}


export default {
  parse,
  dump
};
