import path from 'path';
import { unifyScripts, constants } from 'auth0-source-control-extension-tools';

import { groupFiles, parseFileGroup } from 'src/utils';

export default function parse(folder, mappings) {
  const resourceFolder = path.join(folder, constants.RESOURCE_SERVERS_DIRECTORY);
  const filesGrouped = groupFiles(resourceFolder);

  const resources = Object.entries(filesGrouped)
    .map(([ name, files ]) => parseFileGroup(name, files, mappings))
    .filter(p => Object.keys(p).length > 1); // Filter out invalid clients that have only name key set

  return {
    resourceServers: unifyScripts(resources, {})
  };
}
