import path from 'path';
import fs from 'fs-extra';
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
  encodeCertStringToBase64,
} from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';
import { maskSecretAtPath } from '../../../tools/utils';

type ParsedConnections = ParsedAsset<'connections', Asset[]>;

function parse(context: DirectoryContext): ParsedConnections {
  const connectionDirectory =
    context.config.AUTH0_CONNECTIONS_DIRECTORY || constants.CONNECTIONS_DIRECTORY;
  const connectionsFolder = path.join(context.filePath, connectionDirectory);
  if (!existsMustBeDir(connectionsFolder)) return { connections: null }; // Skip

  const foundFiles = getFiles(connectionsFolder, ['.json']);

  const connections = foundFiles
    .map((f) => {
      const connection = loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      });

      if (connection.strategy === 'email') {
        ensureProp(connection, 'options.email.body');
        const htmlFileName = path.join(connectionsFolder, connection.options.email.body);

        if (!isFile(htmlFileName)) {
          throw new Error(
            `Passwordless email template purportedly located at ${htmlFileName} does not exist for connection. Ensure the existence of this file to proceed with deployment.`
          );
        }
        connection.options.email.body = loadFileAndReplaceKeywords(htmlFileName, {
          mappings: context.mappings,
          disableKeywordReplacement: context.disableKeywordReplacement,
        });
      }

      return connection;
    })
    .filter((p) => Object.keys(p).length > 0); // Filter out empty connections

  return {
    connections,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { connections, clientsOrig } = context.assets;

  if (!connections) return; // Skip, nothing to dump

  const connectionsFolder = path.join(context.filePath, constants.CONNECTIONS_DIRECTORY);
  fs.ensureDirSync(connectionsFolder);

  // Convert enabled_clients from id to name
  connections.forEach((connection) => {
    const dumpedConnection = {
      ...connection,
      ...(connection.enabled_clients && {
        enabled_clients: mapClientID2NameSorted(connection.enabled_clients, clientsOrig || []),
      }),
    };

    const connectionName = sanitize(dumpedConnection.name);

    if (connection.options) {
      // Mask secret for key: connection.options.client_secret
      maskSecretAtPath(connection.options, 'client_secret', 'connections', connection.strategy);
    }

    if (dumpedConnection.strategy === 'email') {
      ensureProp(dumpedConnection, 'options.email.body');
      const html = dumpedConnection.options.email.body;
      const emailConnectionHtml = path.join(connectionsFolder, `${connectionName}.html`);

      log.info(`Writing ${emailConnectionHtml}`);
      fs.writeFileSync(emailConnectionHtml, html);

      dumpedConnection.options.email.body = `./${connectionName}.html`;
    }

    if (dumpedConnection.strategy === 'samlp' && dumpedConnection.options) {
      if ('cert' in dumpedConnection.options) {
        dumpedConnection.options.cert = encodeCertStringToBase64(dumpedConnection.options.cert);
      }

      if ('signingCert' in dumpedConnection.options) {
        dumpedConnection.options.signingCert = encodeCertStringToBase64(
          dumpedConnection.options.signingCert
        );
      }
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
