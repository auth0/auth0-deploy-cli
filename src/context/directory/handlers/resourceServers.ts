import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset } from '../../../types';

type ParsedResourceServers = {
  resourceServers: Asset[] | null;
};

function parse(context: DirectoryContext): ParsedResourceServers {
  const resourceServersFolder = path.join(context.filePath, constants.RESOURCE_SERVERS_DIRECTORY);
  if (!existsMustBeDir(resourceServersFolder)) return { resourceServers: null }; // Skip

  const foundFiles = getFiles(resourceServersFolder, ['.json']);

  const resourceServers = foundFiles
    .map((f) => loadJSON(f, context.mappings))
    .filter((p) => Object.keys(p).length > 0); // Filter out empty resourceServers

  return {
    resourceServers,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { resourceServers } = context.assets;

  if (!resourceServers) return; // Skip, nothing to dump

  const resourceServersFolder = path.join(context.filePath, constants.RESOURCE_SERVERS_DIRECTORY);
  fs.ensureDirSync(resourceServersFolder);

  resourceServers.forEach((resourceServer) => {
    const resourceServerFile = path.join(
      resourceServersFolder,
      sanitize(`${resourceServer.name}.json`)
    );
    dumpJSON(resourceServerFile, resourceServer);
  });
}

const resourceServersHandler: DirectoryHandler<ParsedResourceServers> = {
  parse,
  dump,
};

export default resourceServersHandler;
