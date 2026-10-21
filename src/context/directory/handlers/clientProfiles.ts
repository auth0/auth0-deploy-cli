import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';

import { dumpJSON, existsMustBeDir, getFiles, loadJSON, sanitize } from '../../../utils';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { ClientProfile } from '../../../tools/auth0/handlers/clientProfiles';

type ParsedClientProfiles = ParsedAsset<'clientProfiles', Partial<ClientProfile>[]>;

function parse(context: DirectoryContext): ParsedClientProfiles {
  const clientProfilesFolder = path.join(context.filePath, constants.CLIENT_PROFILES_DIRECTORY);
  if (!existsMustBeDir(clientProfilesFolder)) return { clientProfiles: null }; // Skip

  const files = getFiles(clientProfilesFolder, ['.json']);

  const clientProfiles = files.map((f) => {
    const profile = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return profile;
  });

  return {
    clientProfiles,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { clientProfiles } = context.assets;
  if (!clientProfiles) return;

  const clientProfilesFolder = path.join(context.filePath, constants.CLIENT_PROFILES_DIRECTORY);
  fs.ensureDirSync(clientProfilesFolder);

  clientProfiles.forEach((profile) => {
    const profileFile = path.join(clientProfilesFolder, sanitize(`${profile.name}.json`));
    log.info(`Writing ${profileFile}`);

    // Remove read-only fields
    const { id, created_at, updated_at, ...rest } = profile;

    dumpJSON(profileFile, rest);
  });
}

const clientProfilesHandler = {
  parse,
  dump,
};

export default clientProfilesHandler;
