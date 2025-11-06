import path from 'path';
import fs from 'fs-extra';
import { ConnectionProfile } from 'auth0';
import { constants } from '../../../tools';
import log from '../../../logger';

import { dumpJSON, existsMustBeDir, getFiles, loadJSON, sanitize } from '../../../utils';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';

type ParsedConnectionProfiles = ParsedAsset<'connectionProfiles', Partial<ConnectionProfile>[]>;

function parse(context: DirectoryContext): ParsedConnectionProfiles {
  const connectionProfilesFolder = path.join(
    context.filePath,
    constants.CONNECTION_PROFILES_DIRECTORY
  );
  if (!existsMustBeDir(connectionProfilesFolder)) return { connectionProfiles: null }; // Skip

  const files = getFiles(connectionProfilesFolder, ['.json']);

  const connectionProfiles = files.map((f) => {
    const profile = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return profile;
  });

  return {
    connectionProfiles,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { connectionProfiles } = context.assets;
  if (!connectionProfiles) return;

  const connectionProfilesFolder = path.join(
    context.filePath,
    constants.CONNECTION_PROFILES_DIRECTORY
  );
  fs.ensureDirSync(connectionProfilesFolder);

  connectionProfiles.forEach((profile) => {
    const profileFile = path.join(connectionProfilesFolder, sanitize(`${profile.name}.json`));
    log.info(`Writing ${profileFile}`);

    // Remove read-only fields
    if ('id' in profile) {
      delete profile.id;
    }

    dumpJSON(profileFile, profile);
  });
}

const connectionProfilesHandler = {
  parse,
  dump,
};

export default connectionProfilesHandler;
