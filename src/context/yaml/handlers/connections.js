async function parse(context) {
  // nothing to do, set default if empty
  return {
    connections: [ ...context.assets.connections || [] ]
  };
}

async function dump(context) {
  // nothing to do, set default if empty
  return {
    connections: [ ...context.assets.connections || [] ]
  };
}


export default {
  parse,
  dump
};
