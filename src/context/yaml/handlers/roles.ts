import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedRoles = {
  roles: Asset[] | null;
};

async function parse(context: YAMLContext): Promise<ParsedRoles> {
  // nothing to do, set default empty
  return {
    roles: context.assets.roles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedRoles> {
  // remove empty descriptions
  return {
    roles: [
      ...(context.assets.roles || []).map((role) => {
        if (role.description === null) {
          delete role.description;
        }

        return role;
      }),
    ],
  };
}

const rolesHandler: YAMLHandler<ParsedRoles> = {
  parse,
  dump,
};

export default rolesHandler;
