import fs from 'fs-extra';
import path from 'path';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { isFile, getFiles, existsMustBeDir, loadJSON, sanitize, clearClientArrays } from '../../../utils';

function parse(context) {
  const clientsFolder = path.join(context.filePath, constants.CLIENTS_DIRECTORY);
  if (!existsMustBeDir(clientsFolder)) return { clients: undefined }; // Skip

  const foundFiles = getFiles(clientsFolder, [ '.json' ]);

  const clients = foundFiles
    .map((f) => {
      const client = loadJSON(f, context.mappings);

      if (client.custom_login_page) {
        const htmlFileName = path.join(clientsFolder, client.custom_login_page);

        if (isFile(htmlFileName)) {
          client.custom_login_page = loadFile(htmlFileName);
        }
      }

      return client;
    })
    .filter(p => Object.keys(p).length > 0); // Filter out empty clients

  return {
    clients
  };
}


async function dump(context) {
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

    log.info(`Writing ${clientFile}`);
    fs.writeFileSync(clientFile, JSON.stringify(clearClientArrays(client), null, 2));
  });
}


export default {
  parse,
  dump
};
