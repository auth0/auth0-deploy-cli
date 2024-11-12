import path from 'path';
import fs from 'fs-extra';
import { isEmpty } from 'lodash';
import { constants } from '../../../tools';

import log from '../../../logger';
import { getFiles, existsMustBeDir, dumpJSON, loadJSON, sanitize } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';

import { FlowVaultConnection } from '../../../tools/auth0/handlers/flowVaultConnections';

type ParsedFlowVaults = ParsedAsset<'flowVaultConnections', FlowVaultConnection[]>;
const FLOWS_VAULT_CONNECTIONS_DIRECTORY = 'flow-vault-connections';

function parse(context: DirectoryContext): ParsedFlowVaults {
  const flowVaultsFolder = path.join(
    context.filePath,
    constants.FLOWS_VAULT_DIRECTORY,
    FLOWS_VAULT_CONNECTIONS_DIRECTORY
  );
  if (!existsMustBeDir(flowVaultsFolder)) return { flowVaultConnections: null }; // Skip

  const files = getFiles(flowVaultsFolder, ['.json']);

  const flowVaultConnections = files.map((f) => {
    const connection = {
      ...loadJSON(f, {
        mappings: context.mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      }),
    };
    return connection;
  });

  return {
    flowVaultConnections,
  };
}

async function dump(context: DirectoryContext) {
  const { flowVaultConnections } = context.assets;

  if (!flowVaultConnections || isEmpty(flowVaultConnections)) return; // Skip, nothing to dump

  const flowVaultsFolder = path.join(
    context.filePath,
    constants.FLOWS_VAULT_DIRECTORY,
    FLOWS_VAULT_CONNECTIONS_DIRECTORY
  );
  fs.ensureDirSync(flowVaultsFolder);

  flowVaultConnections.forEach((connection) => {
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
