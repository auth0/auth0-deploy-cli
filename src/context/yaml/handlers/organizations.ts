import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedOrganizations = {
  organizations: Asset[] | null;
};

async function parse(context: YAMLContext): Promise<ParsedOrganizations> {
  const { organizations } = context.assets;

  if (!organizations) return { organizations: null };

  return {
    organizations,
  };
}

async function dump(context: YAMLContext): Promise<ParsedOrganizations> {
  const { organizations } = context.assets;

  if (!organizations) return { organizations: null };

  return {
    organizations: organizations.map((org) => {
      if (org.connections.length > 0) {
        org.connections = org.connections.map((c) => {
          // connection is a computed field
          const name = c.connection && c.connection.name;
          delete c.connection_id;
          delete c.connection;

          return {
            name,
            ...c,
          };
        });
      }

      return org;
    }),
  };
}

const organizationsHandler: YAMLHandler<ParsedOrganizations> = {
  parse,
  dump,
};

export default organizationsHandler;
