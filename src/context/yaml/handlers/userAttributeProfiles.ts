import { UserAttributeProfile } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedUserAttributeProfiles = ParsedAsset<
  'userAttributeProfiles',
  Partial<UserAttributeProfile>[]
>;

async function parse(context: YAMLContext): Promise<ParsedUserAttributeProfiles> {
  const { userAttributeProfiles } = context.assets;

  if (!userAttributeProfiles) return { userAttributeProfiles: null };

  return {
    userAttributeProfiles,
  };
}

async function dump(context: YAMLContext): Promise<ParsedUserAttributeProfiles> {
  const { userAttributeProfiles } = context.assets;
  if (!userAttributeProfiles) return { userAttributeProfiles: null };

  return {
    userAttributeProfiles,
  };
}

const selfServiceProfileHandler: YAMLHandler<ParsedUserAttributeProfiles> = {
  parse,
  dump,
};

export default selfServiceProfileHandler;
