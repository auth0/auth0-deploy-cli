import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { FlowVault } from '../../../tools/auth0/handlers/flowVaults';

type ParsedParsedFlowVaults = ParsedAsset<'flowVaults', FlowVault>;

async function parseAndDump(context: YAMLContext): Promise<ParsedParsedFlowVaults> {
  const { flowVaults } = context.assets;

  if (!flowVaults) return { flowVaults: null };

  return {
    flowVaults,
  };
}

const pagesHandler: YAMLHandler<ParsedParsedFlowVaults> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default pagesHandler;
