async function parse(context) {
  // nothing to do, set default if empty
  return {
    resourceServers: context.assets.resourceServers
  };
}

async function dump(context) {
  // nothing to do, set default if empty
  return {
    resourceServers: [ ...context.assets.resourceServers || [] ]
  };
}

export default {
  parse,
  dump
};
