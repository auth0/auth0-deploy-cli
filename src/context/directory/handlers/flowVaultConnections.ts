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

function parse(context: DirectoryContext): ParsedFlowVaults {
  const flowVaultsFolder = path.join(context.filePath, constants.FLOWS_VAULT_DIRECTORY);
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

  // Check if there is any duplicate form name
  const vaultConnectionsNamesSet = new Set<string>();
  const duplicateVaultConnectionsNames = new Set<string>();

  flowVaultConnections.forEach((form) => {
    if (vaultConnectionsNamesSet.has(form.name)) {
      duplicateVaultConnectionsNames.add(form.name);
    } else {
      vaultConnectionsNamesSet.add(form.name);
    }
  });

  if (duplicateVaultConnectionsNames.size > 0) {
    const duplicatesArray = Array.from(duplicateVaultConnectionsNames);
    log.error(
      `Duplicate flow vault connections names found: [${duplicatesArray}] , make sure to rename them to avoid conflicts`
    );
    throw new Error(`Duplicate flow vault connections names found: ${duplicatesArray}`);
  }

  const flowVaultsFolder = path.join(context.filePath, constants.FLOWS_VAULT_DIRECTORY);
  fs.ensureDirSync(flowVaultsFolder);

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'refreshed_at', 'fingerprint'];
  flowVaultConnections.forEach((connection) => {
    removeKeysFromOutput.forEach((key) => {
      if (key in connection) {
        delete connection[key];
      }
    });
  });

  // eslint-disable-next-line no-console
  console.warn(
    'WARNING! Flow vault connections `setup` key does not support keyword preservation, `export` or `dump` commmand will not preserve `setup` key in local configuration file.'
  );

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
