async function dump(context) {
  return (context.assets.roles || []).map(role => ({
    type: 'auth0_role',
    name: role.name,
    content: {
      name: role.name,
      description: role.description,
      permissions: (role.permissions || []).map(permission => ({
        resource_server_identifier: permission.resource_server_identifier,
        name: permission.permission_name
      }))
    }
  }));
}


export default {
  dump
};
