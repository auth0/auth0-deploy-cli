import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import { groupFiles, existsMustBeDir, parseFileGroup } from 'src/utils';

export default function parse(folder, mappings) {
  const clientsFolder = path.join(folder, constants.CLIENTS_DIRECTORY);
  existsMustBeDir(clientsFolder);
  const filesGrouped = groupFiles(clientsFolder);

  const clients = Object.entries(filesGrouped)
    .map(([ name, files ]) => parseFileGroup(name, files, mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty clients

  return {
    clients
  };
}
