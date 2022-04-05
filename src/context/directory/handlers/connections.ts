import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import {
  isFile,
  getFiles,
  existsMustBeDir,
  dumpJSON,
  loadJSON,
  sanitize,
  ensureProp,
  mapClientID2NameSorted,
} from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';

type ParsedConnections = {
  connections: unknown[] | undefined;
};

function parse(context: DirectoryContext): ParsedConnections {
  const connectionDirectory =
    context.config.AUTH0_CONNECTIONS_DIRECTORY || constants.CONNECTIONS_DIRECTORY;
  const connectionsFolder = path.join(context.filePath, connectionDirectory);
  if (!existsMustBeDir(connectionsFolder)) return { connections: undefined }; // Skip

  const foundFiles = getFiles(connectionsFolder, ['.json']);

  const connections = foundFiles
    .map((f) => {
      const connection = loadJSON(f, context.mappings);

      if (connection.strategy === 'email') {
        ensureProp(connection, 'options.email.body');
        const htmlFileName = path.join(connectionsFolder, connection.options.email.body);

        if (isFile(htmlFileName)) {
          connection.options.email.body = loadFileAndReplaceKeywords(
            htmlFileName,
            context.mappings
          );
        }
      }

      return connection;
    })
    .filter((p) => Object.keys(p).length > 0); // Filter out empty connections

  return {
    connections,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { connections } = context.assets;

  if (!connections) return; // Skip, nothing to dump

  const connectionsFolder = path.join(context.filePath, constants.CONNECTIONS_DIRECTORY);
  fs.ensureDirSync(connectionsFolder);

  // Convert enabled_clients from id to name
  connections.forEach((connection) => {
    const dumpedConnection = {
      ...connection,
      ...(connection.enabled_clients && {
        enabled_clients: mapClientID2NameSorted(
          connection.enabled_clients,
          context.assets.clientsOrig
        ),
      }),
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
    dumpJSON(connectionFile, dumpedConnection);
  });
}

const connectionsHandler: DirectoryHandler<ParsedConnections> = {
  parse,
  dump,
};

export default connectionsHandler;
