import fs from 'fs-extra';
import path from 'path';
import { constants, loadFileAndReplaceKeywords } from '../../../tools';

import log from '../../../logger';
import {
  isFile, getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize, clearClientArrays
} from '../../../utils';
import { DirectoryHandler } from '.'
import DirectoryContext from '..';

type ParsedClients = {
  clients: unknown | undefined
}

function parse(context: DirectoryContext): ParsedClients {
  const clientsFolder = path.join(context.filePath, constants.CLIENTS_DIRECTORY);
  if (!existsMustBeDir(clientsFolder)) return { clients: undefined }; // Skip

  const foundFiles = getFiles(clientsFolder, [ '.json' ]);

  const clients = foundFiles
    .map((f) => {
      const client = loadJSON(f, context.mappings);

      if (client.custom_login_page) {
        const htmlFileName = path.join(clientsFolder, client.custom_login_page);

        if (isFile(htmlFileName)) {
          client.custom_login_page = loadFileAndReplaceKeywords(htmlFileName, context.mappings);
        }
      }

      return client;
    })
    .filter((p) => Object.keys(p).length > 0); // Filter out empty clients

  return {
    clients
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { clients } = context.assets;

  if (!clients) return; // Skip, nothing to dump

  const clientsFolder = path.join(context.filePath, constants.CLIENTS_DIRECTORY);
  fs.ensureDirSync(clientsFolder);

  clients.forEach((client) => {
    const clientName = sanitize(client.name);
    const clientFile = path.join(clientsFolder, `${clientName}.json`);

    if (client.custom_login_page) {
      const html = client.custom_login_page;
      const customLoginHtml = path.join(clientsFolder, `${clientName}_custom_login_page.html`);

      log.info(`Writing ${customLoginHtml}`);
      fs.writeFileSync(customLoginHtml, html);

      client.custom_login_page = `./${clientName}_custom_login_page.html`;
    }
    dumpJSON(clientFile, clearClientArrays(client));
  });
}

const clientsHandler: DirectoryHandler<ParsedClients> = {
  parse,
  dump,
}

export default clientsHandler;