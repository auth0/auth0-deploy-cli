import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';

import { dumpJSON, existsMustBeDir, getFiles, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { SsProfileWithCustomText } from '../../../tools/auth0/handlers/selfServiceProfiles';

type ParsedSelfServiceProfiles = ParsedAsset<
  'selfServiceProfiles',
  Partial<SsProfileWithCustomText>[]
>;

function parse(context: DirectoryContext): ParsedSelfServiceProfiles {
  const selfServiceProfilesFolder = path.join(
    context.filePath,
    constants.SELF_SERVICE_PROFILE_DIRECTORY
  );
  if (!existsMustBeDir(selfServiceProfilesFolder)) return { selfServiceProfiles: null }; // Skip

  const files = getFiles(selfServiceProfilesFolder, ['.json']);

  const selfServiceProfiles = files.map((f) => {
    const ssProfiles = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return ssProfiles;
  });

  return {
    selfServiceProfiles,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { selfServiceProfiles, userAttributeProfilesWithId } = context.assets;
  if (!selfServiceProfiles) return;

  const selfServiceProfilesFolder = path.join(
    context.filePath,
    constants.SELF_SERVICE_PROFILE_DIRECTORY
  );
  fs.ensureDirSync(selfServiceProfilesFolder);

  selfServiceProfiles.forEach((profile) => {
    const ssProfileFile = path.join(selfServiceProfilesFolder, sanitize(`${profile.name}.json`));
    log.info(`Writing ${ssProfileFile}`);

    if ('created_at' in profile) {
      delete profile.created_at;
    }

    if ('updated_at' in profile) {
      delete profile.updated_at;
    }

    if (profile.user_attribute_profile_id) {
      const p = userAttributeProfilesWithId?.find(uap => uap.id === profile.user_attribute_profile_id);
      profile.user_attribute_profile_id = p?.name || profile.user_attribute_profile_id;

      if (profile.user_attributes.length === 0) {
        // @ts-expect-error - ignore type error here as we know that user_attributes can be removed.
        delete profile.user_attributes;
      }
    }

    dumpJSON(ssProfileFile, profile);
  });
}

const emailProviderHandler: DirectoryHandler<ParsedSelfServiceProfiles> = {
  parse,
  dump,
};

export default emailProviderHandler;
