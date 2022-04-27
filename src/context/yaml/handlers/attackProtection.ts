import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedAttackProtection = ParsedAsset<
  'attackProtection',
  {
    breachedPasswordDetection: Asset;
    bruteForceProtection: Asset;
    suspiciousIpThrottling: Asset;
  }
>;

async function parseAndDump(context: YAMLContext): Promise<ParsedAttackProtection> {
  const { attackProtection } = context.assets;

  if (!attackProtection) return { attackProtection: null };

  const { suspiciousIpThrottling, breachedPasswordDetection, bruteForceProtection } =
    attackProtection;

  return {
    attackProtection: {
      suspiciousIpThrottling,
      breachedPasswordDetection,
      bruteForceProtection,
    },
  };
}

const attackProtectionHandler: YAMLHandler<ParsedAttackProtection> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default attackProtectionHandler;
