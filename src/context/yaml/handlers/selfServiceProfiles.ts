import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { SsProfileWithCustomText } from '../../../tools/auth0/handlers/selfServiceProfiles';

type ParsedSelfServiceProfiles = ParsedAsset<
  'selfServiceProfiles',
  Partial<SsProfileWithCustomText>[]
>;

async function parse(context: YAMLContext): Promise<ParsedSelfServiceProfiles> {
  const { selfServiceProfiles } = context.assets;

  if (!selfServiceProfiles) return { selfServiceProfiles: null };

  return {
    selfServiceProfiles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedSelfServiceProfiles> {
  let { selfServiceProfiles } = context.assets;
  if (!selfServiceProfiles) return { selfServiceProfiles: null };

  selfServiceProfiles = selfServiceProfiles.map((profile) => {
    if ('created_at' in profile) {
      delete profile.created_at;
    }

    if ('updated_at' in profile) {
      delete profile.updated_at;
    }

    return {
      ...profile,
    };
  });

  return {
    selfServiceProfiles,
  };
}

const selfServiceProfileHandler: YAMLHandler<ParsedSelfServiceProfiles> = {
  parse,
  dump,
};

export default selfServiceProfileHandler;
