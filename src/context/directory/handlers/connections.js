import fs from 'fs-extra';
import path from 'path';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { isFile, getFiles, existsMustBeDir, loadJSON, sanitize, ensureProp } from '../../../utils';

function parse(context) {
  const connectionDirectory = context.config.AUTH0_CONNECTIONS_DIRECTORY || constants.CONNECTIONS_DIRECTORY;
  const connectionsFolder = path.join(context.filePath, connectionDirectory);
  if (!existsMustBeDir(connectionsFolder)) return { connections: [] }; // Skip

  const foundFiles = getFiles(connectionsFolder, [ '.json' ]);

  const connections = foundFiles
    .map((f) => {
      const connection = loadJSON(f, context.mappings);

      if (connection.strategy === 'email') {
        ensureProp(connection, 'options.email.body');
        const htmlFileName = path.join(connectionsFolder, connection.options.email.body);

        if (isFile(htmlFileName)) {
          connection.options.email.body = loadFile(htmlFileName, context.mappings);
        }
      }

      return connection;
    })
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

    const connectionName = sanitize(dumpedConnection.name);

    if (dumpedConnection.strategy === 'email') {
      ensureProp(dumpedConnection, 'options.email.body');
      const html = dumpedConnection.options.email.body;
      const emailConnectionHtml = path.join(connectionsFolder, `${connectionName}.html`);

      log.info(`Writing ${emailConnectionHtml}`);
      fs.writeFileSync(emailConnectionHtml, html);

      dumpedConnection.options.email.body = `./${connectionName}.html`;
    }

    const connectionFile = path.join(connectionsFolder, `${connectionName}.json`);
    log.info(`Writing ${connectionFile}`);
    fs.writeFileSync(connectionFile, JSON.stringify(dumpedConnection, null, 2));
  });
}


export default {
  parse,
  dump
};
