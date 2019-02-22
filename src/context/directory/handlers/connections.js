import fs from 'fs-extra';
import path from 'path';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, loadJSON, sanitize } from '../../../utils';

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
  const clients = context.assets.clientsOrig || [];

  if (!connections) return; // Skip, nothing to dump

  const connectionsFolder = path.join(context.filePath, constants.CONNECTIONS_DIRECTORY);
  fs.ensureDirSync(connectionsFolder);

  // Convert enabled_clients from id to name
  connections.forEach((connection) => {
    const dumpedConnection = {
      ...connection,
      enabled_clients: [
        ...(connection.enabled_clients || []).map((clientId) => {
          const found = clients.find(c => c.client_id === clientId);
          if (found) return found.name;
          return clientId;
        })
      ]
    };

    const connectionFile = path.join(connectionsFolder, sanitize(`${dumpedConnection.name}.json`));
    log.info(`Writing ${connectionFile}`);
    fs.writeFileSync(connectionFile, JSON.stringify(dumpedConnection, null, 2));
  });
}


export default {
  parse,
  dump
};
