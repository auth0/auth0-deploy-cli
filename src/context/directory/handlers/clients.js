import path from 'path';
import { unifyScripts, constants } from 'auth0-source-control-extension-tools';

import { groupFiles, parseFileGroup } from 'src/utils';

export default function parse(folder, mappings) {
  const clientsFolder = path.join(folder, constants.CLIENTS_DIRECTORY);
  const filesGrouped = groupFiles(clientsFolder);

  const clients = Object.entries(filesGrouped)
    .map(([ name, files ]) => parseFileGroup(name, files, mappings))
    .filter(p => Object.keys(p).length > 1); // Filter out invalid clients that have only name key set

  return {
    clients: unifyScripts(clients, {})
  };
}
