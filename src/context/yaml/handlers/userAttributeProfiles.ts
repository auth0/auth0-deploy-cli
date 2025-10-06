import { UserAttributeProfile } from 'auth0';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedUserAttributeProfiles = ParsedAsset<
  'userAttributeProfiles',
  Partial<UserAttributeProfile>[]
>;

async function parseAndDump(context: YAMLContext): Promise<ParsedUserAttributeProfiles> {
  const { userAttributeProfiles } = context.assets;

  if (!userAttributeProfiles) return { userAttributeProfiles: null };

  return {
    userAttributeProfiles,
  };
}

const selfServiceProfileHandler: YAMLHandler<ParsedUserAttributeProfiles> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default selfServiceProfileHandler;
