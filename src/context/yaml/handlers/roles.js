async function parse(context) {
  // nothing to do, set default empty
  return {
    roles: context.assets.roles
  };
}

async function dump(context) {
  // remove empty descriptions
  return {
    roles: [
      ...(context.assets.roles || []).map((role) => {
        if (role.description === null) {
          delete role.description;
        }

        return role;
      })
    ]
  };
}

export default {
  parse,
  dump
};
