import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON } from '../../../utils';

function parse(context) {
  const connectionsFolder = path.join(context.filePath, constants.CONNECTIONS_DIRECTORY);
  if (!existsMustBeDir(connectionsFolder)) return { connections: [] }; // Skip

  const foundFiles = getFiles(connectionsFolder, [ '.json' ]);

  const connections = foundFiles.map(f => loadJSON(f, context.mappings))
    .filter(p => Object.keys(p).length > 0); // Filter out empty connections

  return {
    connections
  };
}

async function dump(context) {
  const { connections } = context.assets;

  if (!connections) return; // Skip, nothing to dump

  const connectionsFolder = path.join(context.filePath, constants.CONNECTIONS_DIRECTORY);
  fs.ensureDirSync(connectionsFolder);

  connections.forEach((connection) => {
    const connectionFile = path.join(connectionsFolder, `${connection.name}.json`);
    log.info(`Writing ${connectionFile}`);
    fs.writeFileSync(connectionFile, JSON.stringify(connection, null, 2));
  });
}


export default {
  parse,
  dump
};
