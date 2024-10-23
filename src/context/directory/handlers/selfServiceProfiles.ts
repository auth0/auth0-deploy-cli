import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';

import { existsMustBeDir, isFile, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { emailProviderDefaults } from '../../defaults';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { SelfServiceProfile } from '../../../tools/auth0/handlers/selfServiceProfiles';

type ParsedSelfServiceProfiles = ParsedAsset<'selfServiceProfiles', SelfServiceProfile[]>;

function parse(context: DirectoryContext): ParsedSelfServiceProfiles {
  const { selfServiceProfiles } = context.assets;

  if (!selfServiceProfiles) return { selfServiceProfiles: null };

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

    delete profile.created_at;
    delete profile.updated_at;
    delete profile.allowed_strategies;

    dumpJSON(ssProfileFile, profile);
  });
}

const emailProviderHandler: DirectoryHandler<ParsedSelfServiceProfiles> = {
  parse,
  dump,
};

export default emailProviderHandler;
