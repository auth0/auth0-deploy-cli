import path from 'path';
import fs from 'fs-extra';
import { constants, keywordReplace } from '../../../tools';

import log from '../../../logger';
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

  // Derive the filename for a grant.
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

  const excludedClients = allClients.filter(
    (c) => c.name !== undefined && excludedClientsByNames.includes(c.name)
  );

  // Values that can stand for an excluded client in the `client_id` field of a dumped file: the
  // client name when `clientsOrig` was available at dump time (see `convertClientIdToName` below),
  // the raw client_id otherwise. Names come from the exclude list rather than from `allClients` so
  // that excluding a client absent from the tenant still protects its file.
  const excludedClientIdentities = new Set<string>([
    ...excludedClientsByNames,
    ...excludedClients.map((c) => c.client_id).filter((id): id is string => !!id),
  ]);

  // Whether a file this dump did not write must nonetheless survive the cleanup pass. Its name
  // cannot answer that: the name is derived from the client name, the API name, the grant's
  // subject_type and the current naming format, so a file written by an earlier version — or
  // before its API was renamed — no longer matches the name `nameFor` produces today. Read the
  // file instead, because the client identity recorded inside it does not drift.
  const mustPreserve = (file: string): boolean => {
    if (excludedClientIdentities.size === 0) return false;

    let grant;
    try {
      grant = loadJSON(file, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      });
    } catch (err) {
      // Deleting a file it cannot read is not the export's call to make, and one bad file must not
      // fail the whole export. Keep it and let `parse` report the problem on the next import.
      log.warn(`Keeping ${file}, it could not be read while cleaning up client grants: ${err}`);
      return true;
    }

    return excludedClientIdentities.has(grant?.client_id);
  };

  // Track files written by this dump; everything else in the folder is a cleanup candidate.
  const expectedFiles = new Set<string>();

  // Filter out grants for excluded clients
  if (excludedClientsByNames.length) {
    const excludedClientIds = new Set(excludedClients.map((c) => c.client_id));
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
    .filter((file) => !expectedFiles.has(path.basename(file)) && !mustPreserve(file))
    .forEach((file) => {
      log.info(`Removing ${file}`);
      fs.removeSync(file);
    });
}

const clientGrantsHandler: DirectoryHandler<ParsedClientGrants> = {
  parse,
  dump,
};

export default clientGrantsHandler;
