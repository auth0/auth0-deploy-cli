import { Client, ResourceServer } from 'auth0/legacy';
import path from 'path';
import fs from 'fs-extra';
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
import { paginate } from '../../../tools/auth0/client';

type ParsedResourceServers = ParsedAsset<'resourceServers', ResourceServer[]>;

function parse(context: DirectoryContext): ParsedResourceServers {
  const resourceServersFolder = path.join(context.filePath, constants.RESOURCE_SERVERS_DIRECTORY);
  if (!existsMustBeDir(resourceServersFolder)) return { resourceServers: null }; // Skip

  const foundFiles = getFiles(resourceServersFolder, ['.json']);

  const resourceServers = foundFiles
    .map((f) =>
      loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      })
    )
    .filter((p) => Object.keys(p).length > 0); // Filter out empty resourceServers

  return {
    resourceServers,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { resourceServers } = context.assets;
  let { clients } = context.assets;

  if (!resourceServers) return; // Skip, nothing to dump

  const resourceServersFolder = path.join(context.filePath, constants.RESOURCE_SERVERS_DIRECTORY);
  fs.ensureDirSync(resourceServersFolder);

  if (clients === undefined) {
    clients = await paginate<Client>(context.mgmtClient.clients.getAll, {
      paginate: true,
      include_totals: true,
    });
  }

  resourceServers.forEach((resourceServer) => {
    const resourceServerFile = path.join(
      resourceServersFolder,
      sanitize(`${resourceServer.name}.json`)
    );
    if (resourceServer.client_id) {
      resourceServer.client_id = convertClientIdToName(resourceServer.client_id, clients || []);
    }
    dumpJSON(resourceServerFile, resourceServer);
  });
}

const resourceServersHandler: DirectoryHandler<ParsedResourceServers> = {
  parse,
  dump,
};

export default resourceServersHandler;
