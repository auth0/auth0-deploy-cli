async function parse(context) {
  // nothing to do, set default empty
  return {
    roles: context.assets.roles
  };
}

async function dump(context) {
  // nothing to do, set default empty
  return {
    roles: [ ...context.assets.roles || [] ]
  };
}

export default {
  parse,
  dump
};
