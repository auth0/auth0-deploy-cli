import { YAMLHandler, Context } from '.'

type ParsedRoles = {
  roles: unknown[]
}

async function parse(context: Context): Promise<ParsedRoles> {
  // nothing to do, set default empty
  return {
    roles: context.assets.roles
  };
}

async function dump(context: Context): Promise<ParsedRoles> {
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

const rolesHandler: YAMLHandler<ParsedRoles> = {
  parse,
  dump,
};

export default rolesHandler;