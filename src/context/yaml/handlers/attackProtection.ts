import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset } from '../../../types';

type ParsedAttackProtection = {
  attackProtection: Asset;
};

async function parseAndDump(context: YAMLContext): Promise<ParsedAttackProtection> {
  return {
    attackProtection: context.assets.attackProtection || {},
  };
}

const attackProtectionHandler: YAMLHandler<ParsedAttackProtection> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default attackProtectionHandler;
