import { SsProfile } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedSelfServiceProfiles = ParsedAsset<'selfServiceProfiles', Partial<SsProfile>[]>;

async function parse(context: YAMLContext): Promise<ParsedSelfServiceProfiles> {
  const { selfServiceProfiles } = context.assets;

  if (!selfServiceProfiles) return { selfServiceProfiles: null };

  return {
    selfServiceProfiles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedSelfServiceProfiles> {
  const { selfServiceProfiles } = context.assets;
  if (!selfServiceProfiles) return { selfServiceProfiles: null };

  // selfServiceProfiles = selfServiceProfiles.map((profile) => {
  //   delete profile.created_at;
  //   delete profile.updated_at;

  //   return {
  //     ...profile,
  //   };
  // });

  return {
    selfServiceProfiles,
  };
}

const selfServiceProfileHandler: YAMLHandler<ParsedSelfServiceProfiles> = {
  parse,
  dump,
};

export default selfServiceProfileHandler;
