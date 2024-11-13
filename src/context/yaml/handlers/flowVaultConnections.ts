import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { FlowVaultConnection } from '../../../tools/auth0/handlers/flowVaultConnections';
import log from '../../../logger';

type ParsedParsedFlowVaults = ParsedAsset<'flowVaultConnections', FlowVaultConnection[]>;

async function dump(context: YAMLContext): Promise<ParsedParsedFlowVaults> {
  const { flowVaultConnections } = context.assets;

  if (!flowVaultConnections) return { flowVaultConnections: null };

  // Check if there is any duplicate form name
  const vaultConnectionsNames = flowVaultConnections.map((form) => form.name);
  const duplicateVaultConnectionsNames = vaultConnectionsNames.filter(
    (name, index) => vaultConnectionsNames.indexOf(name) !== index
  );

  if (duplicateVaultConnectionsNames.length > 0) {
    log.error(
      `Duplicate form names found: [${duplicateVaultConnectionsNames.join(
        ', '
      )}] , make sure to rename them to avoid conflicts`
    );
    throw new Error(
      `Duplicate flow vault connections names found: ${duplicateVaultConnectionsNames.join(', ')}`
    );
  }

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'refreshed_at', 'fingerprint'];
  removeKeysFromOutput.forEach((key) => {
    flowVaultConnections.forEach((connection) => {
      if (key in connection) {
        delete connection[key];
      }
    });
  });

  console.warn(
    'WARNING! Flow vault connections `setup` key does not support keyword preservation, `export` or `dump` commmand will not preserve `setup` key in local configuration file.'
  );

  return {
    flowVaultConnections,
  };
}

async function parse(context: YAMLContext): Promise<ParsedParsedFlowVaults> {
  const { flowVaultConnections } = context.assets;

  if (!flowVaultConnections) return { flowVaultConnections: null };

  return {
    flowVaultConnections,
  };
}

const pagesHandler: YAMLHandler<ParsedParsedFlowVaults> = {
  parse,
  dump,
};

export default pagesHandler;
