import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize, convertClientIdToName } from '../../../utils';

function parse(context) {
  const grantsFolder = path.join(context.filePath, constants.CLIENTS_GRANTS_DIRECTORY);
  if (!existsMustBeDir(grantsFolder)) return { clientGrants: undefined }; // Skip

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

  // Convert client_id to the client name for readability
  clientGrants.forEach((grant) => {
    const dumpGrant = { ...grant };
    dumpGrant.client_id = convertClientIdToName(dumpGrant.client_id, context.assets.clientsOrig);

    const name = sanitize(`${dumpGrant.client_id} (${dumpGrant.audience})`);
    const grantFile = path.join(grantsFolder, `${name}.json`);
    dumpJSON(grantFile, dumpGrant);
  });
}


export default {
  parse,
  dump
};
