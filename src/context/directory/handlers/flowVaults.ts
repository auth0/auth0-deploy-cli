import path from 'path';
import fs from 'fs-extra';
import { isEmpty } from 'lodash';
import { constants } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';

import { FlowVault } from '../../../tools/auth0/handlers/flowVaults';

type ParsedFlowVaults = ParsedAsset<'flowVaults', FlowVault>;
const FLOWS_VAULT_CONNECTIONS_DIRECTORY = 'connections';

function parse(context: DirectoryContext): ParsedFlowVaults {
  const flowVaultsFolder = path.join(
    context.filePath,
    constants.FLOWS_VAULT_DIRECTORY,
    FLOWS_VAULT_CONNECTIONS_DIRECTORY
  );
  if (!existsMustBeDir(flowVaultsFolder)) return { flowVaults: null }; // Skip

  const files = getFiles(flowVaultsFolder, ['.json']);

  const flowVaultsConnections = files.map((f) => {
    const connection = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return connection;
  });

  const flowVaults = {
    connections: flowVaultsConnections,
  };

  return {
    flowVaults,
  };
}

async function dump(context: DirectoryContext) {
  const { flowVaults } = context.assets;

  if (!flowVaults || isEmpty(flowVaults.connections)) return; // Skip, nothing to dump

  const flowVaultsFolder = path.join(
    context.filePath,
    constants.FLOWS_VAULT_DIRECTORY,
    FLOWS_VAULT_CONNECTIONS_DIRECTORY
  );
  fs.ensureDirSync(flowVaultsFolder);

  flowVaults.connections.forEach((connection) => {
    const connectionFile = path.join(flowVaultsFolder, sanitize(`${connection.name}.json`));
    log.info(`Writing ${connectionFile}`);

    dumpJSON(connectionFile, connection);
  });
}

const flowVaultsHandler: DirectoryHandler<ParsedFlowVaults> = {
  parse,
  dump,
};

export default flowVaultsHandler;
