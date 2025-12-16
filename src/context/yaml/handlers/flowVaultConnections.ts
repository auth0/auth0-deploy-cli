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
  const vaultConnectionsNames = new Set();
  const duplicateVaultConnectionsNames = new Set();

  flowVaultConnections.forEach((form) => {
    if (vaultConnectionsNames.has(form.name)) {
      duplicateVaultConnectionsNames.add(form.name);
    } else {
      vaultConnectionsNames.add(form.name);
    }
  });

  if (duplicateVaultConnectionsNames.size > 0) {
    const duplicatesArray = Array.from(duplicateVaultConnectionsNames).join(', ');
    log.error(
      `Duplicate flow vault connections names found: [${duplicatesArray}] , make sure to rename them to avoid conflicts`
    );
    throw new Error(`Duplicate flow vault connections names found: ${duplicatesArray}`);
  }

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
