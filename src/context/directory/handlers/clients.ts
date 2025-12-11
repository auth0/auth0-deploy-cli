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
  clearClientArrays,
} from '../../../utils';
import { ParsedAsset } from '../../../types';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Client } from '../../../tools/auth0/handlers/clients';

type ParsedClients = ParsedAsset<'clients', Client[]>;

function parse(context: DirectoryContext): ParsedClients {
  const clientsFolder = path.join(context.filePath, constants.CLIENTS_DIRECTORY);
  if (!existsMustBeDir(clientsFolder)) return { clients: null }; // Skip

  const foundFiles = getFiles(clientsFolder, ['.json']);

  const clients = foundFiles
    .map((f) => {
      const client = loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      });

      if (client.custom_login_page) {
        const htmlFileName = path.join(clientsFolder, client.custom_login_page);

        if (isFile(htmlFileName)) {
          client.custom_login_page = loadFileAndReplaceKeywords(htmlFileName, {
            mappings: context.mappings,
            disableKeywordReplacement: context.disableKeywordReplacement,
          });
        }
      }

      return client;
    })
    .filter((p) => Object.keys(p).length > 0); // Filter out empty clients

  return {
    clients,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { clients } = context.assets;
  const { userAttributeProfiles, connectionProfiles } = context.assets;

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

    if (client.express_configuration) {
      // map ids to names for user attribute profiles
      const userAttributeProfileId = client?.express_configuration?.user_attribute_profile_id;
      if (client.express_configuration && userAttributeProfileId) {
        const p = userAttributeProfiles?.find((uap) => uap.id === userAttributeProfileId);
        client.express_configuration.user_attribute_profile_id = p?.name || userAttributeProfileId;
      }

      // map ids to names for connection profiles
      const connectionProfilesProfileId = client?.express_configuration?.connection_profile_id;
      if (client.express_configuration && connectionProfilesProfileId) {
        const c = connectionProfiles?.find((uap) => uap.id === connectionProfilesProfileId);
        client.express_configuration.connection_profile_id = c?.name || connectionProfilesProfileId;
      }

      // map ids to names for okta oin clients
      const oktaOinClientId = client?.express_configuration?.okta_oin_client_id;
      if (client.express_configuration && oktaOinClientId) {
        const o = clients?.find((uap) => uap.client_id === oktaOinClientId);
        client.express_configuration.okta_oin_client_id = o?.name || oktaOinClientId;
      }
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

    dumpJSON(clientFile, clearClientArrays(client));
  });
}

const clientsHandler: DirectoryHandler<ParsedClients> = {
  parse,
  dump,
};

export default clientsHandler;
