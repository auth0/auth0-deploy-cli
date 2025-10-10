import path from 'path';
import fs from 'fs-extra';
import { UserAttributeProfile } from 'auth0/legacy';
import { constants } from '../../../tools';
import DirectoryContext from '..';
import { dumpJSON, existsMustBeDir, getFiles, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import { ParsedAsset } from '../../../types';

type ParsedUserAttributeProfiles = ParsedAsset<
  'userAttributeProfiles',
  Partial<UserAttributeProfile>[]
>;

function parse(context: DirectoryContext): ParsedUserAttributeProfiles {
  const userAttributeProfilesFolder = path.join(
    context.filePath,
    constants.USER_ATTRIBUTE_PROFILES_DIRECTORY
  );
  if (!existsMustBeDir(userAttributeProfilesFolder)) return { userAttributeProfiles: null }; // Skip

  const files = getFiles(userAttributeProfilesFolder, ['.json']);

  const userAttributeProfiles = files.map((f) => {
    const uaProfiles = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return uaProfiles;
  });

  return {
    userAttributeProfiles,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { userAttributeProfiles } = context.assets;
  if (!userAttributeProfiles) return;

  const userAttributeProfilesFolder = path.join(
    context.filePath,
    constants.USER_ATTRIBUTE_PROFILES_DIRECTORY
  );
  fs.ensureDirSync(userAttributeProfilesFolder);

  userAttributeProfiles.forEach((profile) => {
    const profileName = sanitize(profile.name!);
    const uapFile = path.join(userAttributeProfilesFolder, `${profileName}.json`);
    dumpJSON(uapFile, profile);
  });
}

const userAttributeProfilesHandler: DirectoryHandler<ParsedUserAttributeProfiles> = {
  parse,
  dump,
};

export default userAttributeProfilesHandler;
