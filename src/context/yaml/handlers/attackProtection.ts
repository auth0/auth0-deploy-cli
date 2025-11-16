import { YAMLHandler } from '.';
import YAMLContext from '..';
import { AttackProtection } from '../../../tools/auth0/handlers/attackProtection';
import { ParsedAsset } from '../../../types';
import { attackProtectionDefaults } from '../../defaults';

type ParsedAttackProtection = ParsedAsset<'attackProtection', AttackProtection>;

async function parse(context: YAMLContext): Promise<ParsedAttackProtection> {
  const { attackProtection } = context.assets;

  if (!attackProtection) return { attackProtection: null };

  return {
    attackProtection,
  };
}

async function dump(context: YAMLContext): Promise<ParsedAttackProtection> {
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

  const maskedAttackProtection = attackProtectionDefaults(attackProtectionConfig);

  return {
    attackProtection: maskedAttackProtection,
  };
}

const attackProtectionHandler: YAMLHandler<ParsedAttackProtection> = {
  parse: parse,
  dump: dump,
};

export default attackProtectionHandler;
