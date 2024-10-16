import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedRulesConfigs = ParsedAsset<'rulesConfigs', Asset[]>;

async function parse(context: YAMLContext): Promise<ParsedRulesConfigs> {
  const { rulesConfigs } = context.assets;

  if (!rulesConfigs) return { rulesConfigs: null };

  return {
    rulesConfigs,
  };
}

async function dump(context: YAMLContext): Promise<ParsedRulesConfigs> {
  const { rulesConfigs } = context.assets;

  if (!rulesConfigs) return { rulesConfigs: null };

  return {
    rulesConfigs: [], // even if they exist, do not export rulesConfigs as its values cannot be extracted
  };
}

const rulesConfigsHandler: YAMLHandler<ParsedRulesConfigs> = {
  parse,
  dump,
};

export default rulesConfigsHandler;
