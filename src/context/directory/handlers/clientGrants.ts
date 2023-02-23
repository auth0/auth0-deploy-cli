import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';

import {
  getFiles,
  existsMustBeDir,
  dumpJSON,
  loadJSON,
  sanitize,
  convertClientIdToName,
} from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { ClientGrant } from '../../../tools/auth0/handlers/clientGrants';

type ParsedClientGrants = ParsedAsset<'clientGrants', ClientGrant[]>;

function parse(context: DirectoryContext): ParsedClientGrants {
  const grantsFolder = path.join(context.filePath, constants.CLIENTS_GRANTS_DIRECTORY);
  if (!existsMustBeDir(grantsFolder)) return { clientGrants: null }; // Skip

  const foundFiles = getFiles(grantsFolder, ['.json']);

  const clientGrants = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty grants

  return {
    clientGrants,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { clientGrants } = context.assets;

  if (!clientGrants) return; // Skip, nothing to dump

  const grantsFolder = path.join(context.filePath, constants.CLIENTS_GRANTS_DIRECTORY);
  fs.ensureDirSync(grantsFolder);

  if (clientGrants.length === 0) return;

  const allResourceServers = await context.mgmtClient.resourceServers.getAll({
    paginate: true,
  });

  const allClients = await context.mgmtClient.clients.getAll({
    paginate: true,
  });

  // Convert client_id to the client name for readability
  clientGrants.forEach((grant: ClientGrant) => {
    const dumpGrant = { ...grant };

    if (context.assets.clientsOrig) {
      dumpGrant.client_id = convertClientIdToName(dumpGrant.client_id, context.assets.clientsOrig);
    }

    const clientName = (() => {
      const associatedClient = allClients.find((client) => {
        return client.client_id === grant.client_id;
      });

      if (associatedClient === undefined) return grant.client_id;

      return associatedClient.name;
    })();

    const apiName = (() => {
      const associatedAPI = allResourceServers.find((resourceServer) => {
        return resourceServer.identifier === grant.audience;
      });

      if (associatedAPI === undefined) return grant.audience;

      return associatedAPI.name;
    })();

    const name = sanitize(`${clientName}-${apiName}`);
    const grantFile = path.join(grantsFolder, `${name}.json`);

    dumpJSON(grantFile, dumpGrant);
  });
}

const clientGrantsHandler: DirectoryHandler<ParsedClientGrants> = {
  parse,
  dump,
};

export default clientGrantsHandler;
