
async function parse(context) {
  // nothing to do, set default empty
  return {
    clients: context.assets.clients
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    clients: [ ...context.assets.clients || [] ]
  };
}


export default {
  parse,
  dump
};
