import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTokenExchangeProfiles = ParsedAsset<'tokenExchangeProfiles', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedTokenExchangeProfiles> {
  const { tokenExchangeProfiles } = context.assets;

  if (!tokenExchangeProfiles) return { tokenExchangeProfiles: null };

  return {
    tokenExchangeProfiles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedTokenExchangeProfiles> {
  const { tokenExchangeProfiles } = context.assets;

  if (!tokenExchangeProfiles) return { tokenExchangeProfiles: null };

  return {
    tokenExchangeProfiles: tokenExchangeProfiles.map((profile) => {
      // Strip server-generated fields
      const { id, created_at, updated_at, ...cleanProfile } = profile;
      return cleanProfile;
    }),
  };
}

const handler: YAMLHandler<ParsedTokenExchangeProfiles> = {
  parse,
  dump,
};

export default handler;
