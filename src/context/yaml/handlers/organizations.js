async function parse(context) {
  const { organizations } = context.assets;

  return {
    organizations: organizations || []
  };
}

async function dump(context) {
  const { organizations } = context.assets;

  return {
    organizations: [
      ...(organizations || []).map((org) => {
        if (org.connections.length > 0) {
          org.connections = org.connections.map((c) => {
            // connection is a computed field
            const name = c.connection && c.connection.name;
            delete c.connection_id;
            delete c.connection;

            return {
              name,
              ...c
            };
          });
        }

        return org;
      })
    ]
  };
}

export default {
  parse,
  dump
};
