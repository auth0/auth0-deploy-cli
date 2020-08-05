async function parse(context) {
  throw new Error('Not Implemented' + context);
}

async function dump(context) {
  return (context.assets.roles || []).map(role => ({
    type: 'auth0_role',
    name: role.name,
    content: {
      name: role.name,
      description: role.description,
      permissions: (role.permissions || []).map(permission => ({
        resource_server_identifier: permission.resource_server_identifier,
        name: permission.name
      }))
    }
  }));
}


export default {
  parse,
  dump
};
