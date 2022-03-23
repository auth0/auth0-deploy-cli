import { YAMLHandler, Context } from '.'

type ParsedRulesConfigs = {
  rulesConfigs: unknown[]
} | {}

async function parse(context: Context): Promise<ParsedRulesConfigs> {
  // nothing to do, set default if empty
  return {
    rulesConfigs: context.assets.rulesConfigs
  };
}

async function dump(_context: Context): Promise<ParsedRulesConfigs> {
  // do not export rulesConfigs as its values cannot be extracted
  return {
    rulesConfigs: []
  };
}

const rulesConfigsHandler: YAMLHandler<ParsedRulesConfigs> = {
  parse,
  dump,
};

export default rulesConfigsHandler;