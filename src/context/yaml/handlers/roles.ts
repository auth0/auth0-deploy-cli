import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRoles = ParsedAsset<'roles', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedRoles> {
  const { roles } = context.assets;

  if (!roles) return { roles: null };

  return {
    roles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedRoles> {
  const { roles } = context.assets;

  if (!roles) return { roles: null };

  return {
    roles: roles.map((role) => {
      if (role.description === null) {
        delete role.description;
      }

      return role;
    }),
  };
}

const rolesHandler: YAMLHandler<ParsedRoles> = {
  parse,
  dump,
};

export default rolesHandler;
