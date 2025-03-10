import path from 'path';
import fs from 'fs-extra';
import { Client, ResourceServer } from 'auth0';
import { constants, keywordReplace } from '../../../tools';

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
import { paginate } from '../../../tools/auth0/client';
import { doesHaveKeywordMarker } from '../../../keywordPreservation';

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

  const allResourceServers = await paginate<ResourceServer>(
    context.mgmtClient.resourceServers.getAll,
    {
      paginate: true,
      include_totals: true,
    }
  );

  const allClients = await paginate<Client>(context.mgmtClient.clients.getAll, {
    paginate: true,
    include_totals: true,
  });

  // Convert client_id to the client name for readability
  clientGrants.forEach((grant: ClientGrant) => {
    const dumpGrant = { ...grant };

    if (context.assets.clientsOrig) {
      dumpGrant.client_id = convertClientIdToName(dumpGrant.client_id, context.assets.clientsOrig);
    }

    const clientName = (() => {
      const associatedClient = allClients.find((client) => client.client_id === grant.client_id);

      if (associatedClient === undefined) return grant.client_id;

      return associatedClient.name;
    })();

    // Convert audience to the API name for readability
    const apiName = (grantAudience: string) => {
      const associatedAPI = allResourceServers.find(
        (resourceServer) => resourceServer.identifier === grantAudience
      );

      if (associatedAPI === undefined) return grantAudience; // Use the audience if the API is not found

      return associatedAPI.name; // Use the name of the API
    };

    // Generate the initial name using client name and API name
    let name = `${clientName}-${apiName(grant.audience)}`;

    let clientNameNonMarker: string | undefined;
    let apiNameNonMarker: string | undefined;

    // Check if the client name has a keyword marker and replace it if necessary
    if (doesHaveKeywordMarker(clientName, context.mappings)) {
      clientNameNonMarker = keywordReplace(clientName, context.mappings);
    }

    // Check if the API name has a keyword marker and replace it if necessary
    if (doesHaveKeywordMarker(grant.audience, context.mappings)) {
      apiNameNonMarker = keywordReplace(grant.audience, context.mappings);
    }

    // Construct the name based on the presence of non-marker names
    if (clientNameNonMarker && apiNameNonMarker) {
      name = `${clientNameNonMarker}-${apiName(apiNameNonMarker)}`;
    } else if (clientNameNonMarker && !apiNameNonMarker) {
      name = `${clientNameNonMarker}-${apiName(grant.audience)}`;
    } else if (apiNameNonMarker && !clientNameNonMarker) {
      name = `${clientName}-${apiName(apiNameNonMarker)}`;
    } else {
      name = `${clientName}-${apiName(grant.audience)}`;
    }

    // Sanitize the final name
    name = sanitize(name);

    const grantFile = path.join(grantsFolder, `${name}.json`);
    dumpJSON(grantFile, dumpGrant);
  });
}

const clientGrantsHandler: DirectoryHandler<ParsedClientGrants> = {
  parse,
  dump,
};

export default clientGrantsHandler;
