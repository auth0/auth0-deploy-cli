import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';
import { isFile, sanitize, clearClientArrays } from '../../../utils';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { Client } from '../../../tools/auth0/handlers/clients';

type ParsedClients = ParsedAsset<'clients', Client[]>;

async function parse(context: YAMLContext): Promise<ParsedClients> {
  // Load the HTML file for custom_login_page

  const { clients } = context.assets;
  const clientsFolder = path.join(context.basePath, constants.CLIENTS_DIRECTORY);

  if (!clients) {
    return { clients: null };
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
      }),
    ],
  };
}

async function dump(context: YAMLContext): Promise<ParsedClients> {
  // Save custom_login_page to a separate html file
  const clientsFolder = path.join(context.basePath, constants.CLIENTS_DIRECTORY);

  const { clients } = context.assets;
  if (!clients) return { clients: null };

  return {
    clients: [
      ...clients.map((client) => {
        if (client.custom_login_page) {
          const clientName = sanitize(client.name);
          const html = client.custom_login_page;
          const customLoginHtml = path.join(clientsFolder, `${clientName}_custom_login_page.html`);

          log.info(`Writing ${customLoginHtml}`);
          fs.ensureDirSync(clientsFolder);
          fs.writeFileSync(customLoginHtml, html);

          client.custom_login_page = `./${clientName}_custom_login_page.html`;
        }

        return clearClientArrays(client) as Client;
      }),
    ],
  };
}

const clientsHandler: YAMLHandler<ParsedClients> = {
  parse,
  dump,
};

export default clientsHandler;
