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

  let { clients } = context.assets;
  const { userAttributeProfiles, connectionProfiles } = context.assets;

  if (!clients) return { clients: null };

  // map ids to names for user attribute profiles and connection profiles
  clients = clients.map((client) => {
    const userAttributeProfileId = client?.express_configuration?.user_attribute_profile_id;
    if (client.express_configuration && userAttributeProfileId) {
      const p = userAttributeProfiles?.find((uap) => uap.id === userAttributeProfileId);
      client.express_configuration.user_attribute_profile_id = p?.name || userAttributeProfileId;
    }

    const connectionProfilesProfileId = client?.express_configuration?.connection_profile_id;
    if (client.express_configuration && connectionProfilesProfileId) {
      const c = connectionProfiles?.find((uap) => uap.id === connectionProfilesProfileId);
      client.express_configuration.connection_profile_id = c?.name || connectionProfilesProfileId;
    }

    const oktaOinClientId = client?.express_configuration?.okta_oin_client_id;
    if (client.express_configuration && oktaOinClientId) {
      const o = clients?.find((uap) => uap.client_id === oktaOinClientId);
      client.express_configuration.okta_oin_client_id = o?.name || oktaOinClientId;
    }

    return client;
  });

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

        if (client.app_type === 'express_configuration') {
          // only keep relevant fields for express configuration
          client = {
            name: client.name,
            app_type: client.app_type,
            client_authentication_methods: client.client_authentication_methods,
            organization_require_behavior: client.organization_require_behavior,
          } as Client;
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
