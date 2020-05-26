import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';

function parse(context) {
  const resourceServersFolder = path.join(context.filePath, constants.RESOURCE_SERVERS_DIRECTORY);
  if (!existsMustBeDir(resourceServersFolder)) return { resourceServers: undefined }; // Skip

  const foundFiles = getFiles(resourceServersFolder, [ '.json' ]);

  const resourceServers = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty resourceServers

  return {
    resourceServers
  };
}


async function dump(context) {
  const { resourceServers } = context.assets;

  if (!resourceServers) return; // Skip, nothing to dump

  const resourceServersFolder = path.join(context.filePath, constants.RESOURCE_SERVERS_DIRECTORY);
  fs.ensureDirSync(resourceServersFolder);

  resourceServers.forEach((resourceServer) => {
    const resourceServerFile = path.join(resourceServersFolder, sanitize(`${resourceServer.name}.json`));
    log.info(`Writing ${resourceServerFile}`);
    fs.writeFileSync(resourceServerFile, JSON.stringify(resourceServer, null, 2));
  });
}


export default {
  parse,
  dump
};
