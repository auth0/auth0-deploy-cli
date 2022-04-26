import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedAttackProtection = {
  attackProtection: Asset | null;
};

async function parseAndDump(context: YAMLContext): Promise<ParsedAttackProtection> {
  const { attackProtection } = context.assets;

  if (!attackProtection) return { attackProtection: null };

  return {
    attackProtection,
  };
}

const attackProtectionHandler: YAMLHandler<ParsedAttackProtection> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default attackProtectionHandler;
