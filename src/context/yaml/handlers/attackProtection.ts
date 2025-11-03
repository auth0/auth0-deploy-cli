import { YAMLHandler } from '.';
import YAMLContext from '..';
import { AttackProtection } from '../../../tools/auth0/handlers/attackProtection';
import { ParsedAsset } from '../../../types';
import { attackProtectionDefaults } from '../../defaults';

type ParsedAttackProtection = ParsedAsset<'attackProtection', AttackProtection>;

async function parseAndDump(context: YAMLContext): Promise<ParsedAttackProtection> {
  const { attackProtection } = context.assets;

  if (!attackProtection) return { attackProtection: null };

  const {
    botDetection,
    suspiciousIpThrottling,
    breachedPasswordDetection,
    bruteForceProtection,
    captcha,
  } = attackProtection;

  const attackProtectionConfig: ParsedAttackProtection['attackProtection'] = {
    suspiciousIpThrottling,
    breachedPasswordDetection,
    bruteForceProtection,
  };

  if (botDetection) {
    attackProtectionConfig.botDetection = botDetection;
  }

  if (captcha) {
    attackProtectionConfig.captcha = captcha;
  }

  const maskedAttackProtection = attackProtectionDefaults(attackProtection);

  return {
    attackProtection: maskedAttackProtection,
  };
}

const attackProtectionHandler: YAMLHandler<ParsedAttackProtection> = {
  parse: parseAndDump,
  dump: parseAndDump,
};

export default attackProtectionHandler;
