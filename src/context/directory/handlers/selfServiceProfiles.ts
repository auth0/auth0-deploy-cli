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
  const { selfServiceProfiles } = context.assets;
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

    dumpJSON(ssProfileFile, profile);
  });
}

const emailProviderHandler: DirectoryHandler<ParsedSelfServiceProfiles> = {
  parse,
  dump,
};

export default emailProviderHandler;
