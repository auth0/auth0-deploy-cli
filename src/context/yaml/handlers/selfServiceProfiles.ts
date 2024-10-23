import { SsProfile } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { SelfServiceProfile } from '../../../tools/auth0/handlers/selfServiceProfiles';

type ParsedSelfServiceProfiles = ParsedAsset<'selfServiceProfiles', SelfServiceProfile[]>;

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
    delete profile.created_at;
    delete profile.updated_at;
    delete profile.allowed_strategies;
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
