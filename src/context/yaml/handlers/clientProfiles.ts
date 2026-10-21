import YAMLContext from '..';
import { ClientProfile } from '../../../tools/auth0/handlers/clientProfiles';
import { ParsedAsset } from '../../../types';

type ParsedClientProfiles = ParsedAsset<'clientProfiles', Partial<ClientProfile>[]>;

async function parse(context: YAMLContext): Promise<ParsedClientProfiles> {
  const { clientProfiles } = context.assets;

  if (!clientProfiles) return { clientProfiles: null };

  return {
    clientProfiles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedClientProfiles> {
  const { clientProfiles } = context.assets;
  if (!clientProfiles) return { clientProfiles: null };

  return {
    // Remove read-only fields
    clientProfiles: clientProfiles.map(({ id, created_at, updated_at, ...rest }) => rest),
  };
}

const clientProfilesHandler = {
  parse,
  dump,
};

export default clientProfilesHandler;
