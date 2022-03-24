import { YAMLHandler, Context } from '.'

type ParsedAttackProtection = {
  attackProtection: unknown
}

async function parseAndDump(context: Context): Promise<ParsedAttackProtection> {
  return {
    attackProtection: context.assets.attackProtection || {}
  };
}

const attackProtectionHandler: YAMLHandler<ParsedAttackProtection> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default attackProtectionHandler;