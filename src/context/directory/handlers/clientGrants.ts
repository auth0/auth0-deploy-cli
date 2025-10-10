import path from 'path';
import fs from 'fs-extra';
import { Client, ResourceServer } from 'auth0/legacy';
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

    // Replace keyword markers if necessary
    const clientNameNonMarker = doesHaveKeywordMarker(clientName, context.mappings)
      ? keywordReplace(clientName, context.mappings)
      : clientName;
    const apiAudienceNonMarker = doesHaveKeywordMarker(grant.audience, context.mappings)
      ? keywordReplace(grant.audience, context.mappings)
      : grant.audience;

    // Construct the name using non-marker names
    const name = sanitize(`${clientNameNonMarker}-${apiName(apiAudienceNonMarker)}`);

    // Ensure the name is not empty or invalid
    if (!name || name.trim().length === 0) {
      throw new Error(`Invalid name generated for client grant: ${JSON.stringify(grant)}`);
    }

    const grantFile = path.join(grantsFolder, `${name}.json`);
    dumpJSON(grantFile, dumpGrant);
  });
}

const clientGrantsHandler: DirectoryHandler<ParsedClientGrants> = {
  parse,
  dump,
};

export default clientGrantsHandler;
