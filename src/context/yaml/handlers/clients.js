import path from 'path';
import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { isFile, sanitize, clearClientArrays } from '../../../utils';

async function parse(context) {
  // Load the HTML file for custom_login_page

  const { clients } = context.assets;
  const clientsFolder = path.join(context.basePath, constants.CLIENTS_DIRECTORY);

  if (!clients || !clients.length) {
    return { clients: context.assets.clients };
  }

  return {
    clients: [
      ...clients.map((client) => {
        if (client.custom_login_page) {
          const htmlFileName = path.join(clientsFolder, client.custom_login_page);

          if (isFile(htmlFileName)) {
            client.custom_login_page = context.loadFile(htmlFileName);
          }
        }

        return client;
      })
    ]
  };
}

async function dump(context) {
  // Save custom_login_page to a separate html file
  const clientsFolder = path.join(context.basePath, constants.CLIENTS_DIRECTORY);

  return {
    clients: [ ...context.assets.clients.map((client) => {
      if (client.custom_login_page) {
        const clientName = sanitize(client.name);
        const html = client.custom_login_page;
        const customLoginHtml = path.join(clientsFolder, `${clientName}_custom_login_page.html`);

        log.info(`Writing ${customLoginHtml}`);
        fs.ensureDirSync(clientsFolder);
        fs.writeFileSync(customLoginHtml, html);

        client.custom_login_page = `./${clientName}_custom_login_page.html`;
      }

      return clearClientArrays(client);
    }) ]
  };
}


export default {
  parse,
  dump
};
