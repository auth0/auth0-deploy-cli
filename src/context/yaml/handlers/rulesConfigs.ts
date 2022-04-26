import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedRulesConfigs = {
  rulesConfigs: Asset[] | null;
};

async function parse(context: YAMLContext): Promise<ParsedRulesConfigs> {
  // nothing to do, set default if empty
  const { rulesConfigs } = context.assets;

  if (!rulesConfigs) return { rulesConfigs: null };

  return {
    rulesConfigs,
  };
}

async function dump(_context: YAMLContext): Promise<ParsedRulesConfigs> {
  // do not export rulesConfigs as its values cannot be extracted
  return {
    rulesConfigs: [],
  };
}

const rulesConfigsHandler: YAMLHandler<ParsedRulesConfigs> = {
  parse,
  dump,
};

export default rulesConfigsHandler;
