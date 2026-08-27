import path from 'path';
import fs from 'fs-extra';
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
import { ResourceServer } from '../../../tools/auth0/handlers/resourceServers';
import { Client } from '../../../tools/auth0/handlers/clients';

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
  let { clientGrants } = context.assets;

  if (!clientGrants) return; // Skip, nothing to dump

  const grantsFolder = path.join(context.filePath, constants.CLIENTS_GRANTS_DIRECTORY);
  fs.ensureDirSync(grantsFolder);

  if (clientGrants.length === 0) return;

  const excludedClientsByNames = (context.assets.exclude && context.assets.exclude.clients) || [];

  const allResourceServers = await paginate<ResourceServer>(
    context.mgmtClient.resourceServers.list,
    {
      paginate: true,
      include_totals: true,
    }
  );

  const allClients = await paginate<Client>(context.mgmtClient.clients.list, {
    paginate: true,
    include_totals: true,
  });

  // Convert audience to the API name for readability
  const apiName = (grantAudience: string | undefined) => {
    if (!grantAudience) return grantAudience;

    const associatedAPI = allResourceServers.find(
      (resourceServer) => resourceServer.identifier === grantAudience
    );

    if (associatedAPI === undefined) return grantAudience; // Use the audience if the API is not found

    return associatedAPI.name; // Use the name of the API
  };

  // Derive the filename for a grant. Shared by the cleanup pass below, which needs the names of
  // excluded grants before they are filtered out.
  const nameFor = (grant: ClientGrant) => {
    const clientName = (() => {
      const associatedClient = allClients.find((client) => client.client_id === grant.client_id);

      if (associatedClient === undefined) return grant.client_id;

      return associatedClient.name;
    })();

    // Replace keyword markers if necessary
    const clientNameNonMarker = doesHaveKeywordMarker(clientName, context.mappings)
      ? keywordReplace(clientName, context.mappings)
      : clientName;
    const apiAudienceNonMarker = doesHaveKeywordMarker(grant.audience, context.mappings)
      ? keywordReplace(grant.audience, context.mappings)
      : grant.audience;

    // Construct the name using non-marker names. `subject_type` is part of a grant's identity
    // (see `identifiers` in src/tools/auth0/handlers/clientGrants.ts), so it must be included:
    // without it, grants differing only by subject type (e.g. `client` vs `user` on the same
    // client and audience) resolve to the same filename and silently overwrite each other.
    const baseName = `${clientNameNonMarker}-${apiName(apiAudienceNonMarker)}`;

    return sanitize(grant.subject_type ? `${baseName}-${grant.subject_type}` : baseName);
  };

  // Track files that should remain after the dump (written + excluded).
  const expectedFiles = new Set<string>();

  // Filter out grants for excluded clients
  if (excludedClientsByNames.length) {
    const excludedClientIds = new Set(
      allClients
        .filter((c) => c.name !== undefined && excludedClientsByNames.includes(c.name))
        .map((c) => c.client_id)
    );
    // Excluded grants are never written, so record their filenames up front to stop the cleanup
    // pass below from removing files for clients the user deliberately excluded.
    clientGrants
      .filter((grant: ClientGrant) => excludedClientIds.has(grant.client_id))
      .forEach((grant: ClientGrant) => expectedFiles.add(`${nameFor(grant)}.json`));

    clientGrants = clientGrants.filter(
      (grant: ClientGrant) => !excludedClientIds.has(grant.client_id)
    );
  }

  // Convert client_id to the client name for readability
  clientGrants.forEach((grant: ClientGrant) => {
    const dumpGrant = { ...grant };

    if (context.assets.clientsOrig) {
      dumpGrant.client_id = convertClientIdToName(dumpGrant.client_id, context.assets.clientsOrig);
    }

    const name = nameFor(grant);

    // Ensure the name is not empty or invalid
    if (!name || name.trim().length === 0) {
      throw new Error(`Invalid name generated for client grant: ${JSON.stringify(grant)}`);
    }

    const grantFile = path.join(grantsFolder, `${name}.json`);
    dumpJSON(grantFile, dumpGrant);
    expectedFiles.add(`${name}.json`);
  });

  // Remove files that belong to grants no longer present (and not excluded). Without this, a grant
  // whose filename changes is left behind under its old name and parsed back as a duplicate on the
  // next import, and grants deleted from the tenant are silently recreated.
  //
  // Restricted to the `.json` files `parse` reads: anything else in the folder (a README, notes)
  // can never come back as a grant, so it is not stale state and must not be deleted.
  getFiles(grantsFolder, ['.json'])
    .filter((file) => !expectedFiles.has(path.basename(file)))
    .forEach((file) => fs.removeSync(file));
}

const clientGrantsHandler: DirectoryHandler<ParsedClientGrants> = {
  parse,
  dump,
};

export default clientGrantsHandler;
