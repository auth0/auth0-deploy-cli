import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';

function parse(context) {
  const grantsFolder = path.join(context.filePath, constants.CLIENTS_GRANTS_DIRECTORY);
  if (!existsMustBeDir(grantsFolder)) return { clientGrants: [] }; // Skip

  const foundFiles = getFiles(grantsFolder, [ '.json' ]);

  const clientGrants = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty grants

  return {
    clientGrants
  };
}


async function dump(context) {
  const { clientGrants } = context.assets;

  if (!clientGrants) return; // Skip, nothing to dump

  const grantsFolder = path.join(context.filePath, constants.CLIENTS_GRANTS_DIRECTORY);
  fs.ensureDirSync(grantsFolder);

  clientGrants.forEach((grant) => {
    const grantFile = path.join(grantsFolder, `${grant.id}.json`);
    log.info(`Writing ${grantFile}`);
    fs.writeFileSync(grantFile, JSON.stringify(grant, null, 2));
  });
}


export default {
  parse,
  dump
};
