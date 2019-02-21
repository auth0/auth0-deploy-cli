import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';

function parse(context) {
  const clientsFolder = path.join(context.filePath, constants.CLIENTS_DIRECTORY);
  if (!existsMustBeDir(clientsFolder)) return { clients: [] }; // Skip

  const foundFiles = getFiles(clientsFolder, [ '.json' ]);

  const clients = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty clients

  return {
    clients
  };
}


async function dump(context) {
  const { clients } = context.assets;

  if (!clients) return; // Skip, nothing to dump

  const clientsFolder = path.join(context.filePath, constants.CLIENTS_DIRECTORY);
  fs.ensureDirSync(clientsFolder);

  clients.forEach((client) => {
    const clientFile = path.join(clientsFolder, sanitize(`${client.name}.json`));
    log.info(`Writing ${clientFile}`);
    fs.writeFileSync(clientFile, JSON.stringify(client, null, 2));
  });
}


export default {
  parse,
  dump
};
