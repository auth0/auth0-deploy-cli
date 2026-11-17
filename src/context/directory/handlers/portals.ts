import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import log from '../../../logger';
import { paginate } from '../../../tools/auth0/client';
import { Client } from '../../../tools/auth0/handlers/clients';
import {
  dumpJSON,
  existsMustBeDir,
  getFiles,
  loadJSON,
  loadPortalReferences,
  sanitize,
  toExportedPortal,
} from '../../../utils';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { Portal } from '../../../tools/auth0/handlers/portals';
import { portalHasForms } from '../../../tools/utils';

type ParsedPortals = ParsedAsset<'portals', Partial<Portal>[]>;

function parse(context: DirectoryContext): ParsedPortals {
  const portalsFolder = path.join(context.filePath, constants.PORTALS_DIRECTORY);
  if (!existsMustBeDir(portalsFolder)) return { portals: null }; // Skip

  const portals = getFiles(portalsFolder, ['.json'])
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((portal) => Object.keys(portal).length > 0);

  return {
    portals,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { portals } = context.assets;
  if (!portals) return;

  const portalsFolder = path.join(context.filePath, constants.PORTALS_DIRECTORY);
  fs.ensureDirSync(portalsFolder);

  // Slugs are unique per tenant, so they make stable, collision-free file names.
  const fileNames = portals.map((portal) => sanitize(`${portal.slug}.json`));

  // Remove files of portals no longer on the tenant, otherwise the next import recreates them.
  // At the list limit some portals are not returned, so their files cannot be told apart.
  if (portals.length >= constants.PORTALS_LIST_LIMIT) {
    log.warn(
      `Not removing files of portals missing from the export: the API lists at most ${constants.PORTALS_LIST_LIMIT} portals.`
    );
  } else {
    const expectedFiles = new Set(fileNames);
    getFiles(portalsFolder, ['.json'])
      .filter((file) => !expectedFiles.has(path.basename(file)))
      .forEach((file) => {
        log.info(`Removing ${file}`);
        fs.removeSync(file);
      });
  }

  // clientsOrig is always an array, so only trust it when clients were exported; it keeps the
  // client ids that are stripped from the exported clients.
  const clients = await loadPortalReferences(
    portals.some((portal) => portal.client?.client_id),
    context.assets.clients ? context.assets.clientsOrig : null,
    () =>
      paginate<Client>(context.mgmtClient.clients.list, { paginate: true, include_totals: true }),
    'clients'
  );
  // Always listed: exported forms do not keep their ids.
  const forms = await loadPortalReferences(
    portals.some(portalHasForms),
    null,
    () => paginate(context.mgmtClient.forms.list, { paginate: true }),
    'forms'
  );

  portals.forEach((portal, index) => {
    dumpJSON(path.join(portalsFolder, fileNames[index]), toExportedPortal(portal, clients, forms));
  });
}

const portalsHandler = {
  parse,
  dump,
};

export default portalsHandler;
