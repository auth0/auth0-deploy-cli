import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTokenExchangeProfiles = ParsedAsset<'tokenExchangeProfiles', Asset[]>;

function parse(context: DirectoryContext): ParsedTokenExchangeProfiles {
  const folder = path.join(context.filePath, constants.TOKEN_EXCHANGE_PROFILES_DIRECTORY);
  if (!existsMustBeDir(folder)) return { tokenExchangeProfiles: null }; // Skip

  const files = getFiles(folder, ['.json']);

  const profiles = files.map((f) =>
    loadJSON(f, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    })
  );

  return {
    tokenExchangeProfiles: profiles,
  };
}

async function dump(context: DirectoryContext) {
  const { tokenExchangeProfiles } = context.assets;

  if (!tokenExchangeProfiles || !Array.isArray(tokenExchangeProfiles)) return; // Skip

  const folder = path.join(context.filePath, constants.TOKEN_EXCHANGE_PROFILES_DIRECTORY);
  fs.ensureDirSync(folder);

  tokenExchangeProfiles.forEach((profile) => {
    const { id, created_at, updated_at, ...profileWithoutMetadata } = profile;
    const fileName = path.join(folder, sanitize(`${profile.name}.json`));
    log.info(`Writing ${fileName}`);
    dumpJSON(fileName, profileWithoutMetadata);
  });
}

const handler: DirectoryHandler<ParsedTokenExchangeProfiles> = {
  parse,
  dump,
};

export default handler;
