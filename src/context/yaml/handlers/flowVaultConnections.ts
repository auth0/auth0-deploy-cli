import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { FlowVault, FlowVaultConnection } from '../../../tools/auth0/handlers/flowVaultConnections';

type ParsedParsedFlowVaults = ParsedAsset<'flowVaultConnections', FlowVaultConnection[]>;

async function dump(context: YAMLContext): Promise<ParsedParsedFlowVaults> {
  const { flowVaultConnections } = context.assets;

  if (!flowVaultConnections) return { flowVaultConnections: null };

  const removeKeysFromOutput = ['id', 'created_at', 'updated_at', 'refreshed_at'];
  removeKeysFromOutput.forEach((key) => {
    flowVaultConnections.forEach((connection) => {
      if (key in connection) {
        delete connection[key];
      }
    });
  });

  console.log('CLOG: flowVaultConnections', flowVaultConnections);
  return {
    flowVaultConnections
  };
}

async function parse(context: YAMLContext): Promise<ParsedParsedFlowVaults> {
  const { flowVaultConnections } = context.assets;

  if (!flowVaultConnections) return { flowVaultConnections: null };

  return {
    flowVaultConnections
  };
}

const pagesHandler: YAMLHandler<ParsedParsedFlowVaults> = {
  parse,
  dump,
};

export default pagesHandler;
