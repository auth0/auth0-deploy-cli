import { ConnectionProfile } from 'auth0';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedConnectionProfiles = ParsedAsset<'connectionProfiles', Partial<ConnectionProfile>[]>;

async function parse(context: YAMLContext): Promise<ParsedConnectionProfiles> {
  const { connectionProfiles } = context.assets;

  if (!connectionProfiles) return { connectionProfiles: null };

  return {
    connectionProfiles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedConnectionProfiles> {
  let { connectionProfiles } = context.assets;
  if (!connectionProfiles) return { connectionProfiles: null };

  connectionProfiles = connectionProfiles.map((profile) => {
    // Remove read-only fields
    if ('id' in profile) {
      delete profile.id;
    }

    return profile;
  });

  return {
    connectionProfiles,
  };
}

const connectionProfilesHandler = {
  parse,
  dump,
};

export default connectionProfilesHandler;
