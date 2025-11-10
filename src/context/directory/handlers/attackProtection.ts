import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, isFile, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { ParsedAsset } from '../../../types';
import { attackProtectionDefaults } from '../../defaults';
import { AttackProtection } from '../../../tools/auth0/handlers/attackProtection';

type ParsedAttackProtection = ParsedAsset<'attackProtection', AttackProtection>;

function attackProtectionFiles(filePath: string): {
  directory: string;
  botDetection: string;
  breachedPasswordDetection: string;
  bruteForceProtection: string;
  captcha: string;
  suspiciousIpThrottling: string;
} {
  const directory = path.join(filePath, constants.ATTACK_PROTECTION_DIRECTORY);

  return {
    directory: directory,
    botDetection: path.join(directory, 'bot-detection.json'),
    breachedPasswordDetection: path.join(directory, 'breached-password-detection.json'),
    bruteForceProtection: path.join(directory, 'brute-force-protection.json'),
    captcha: path.join(directory, 'captcha.json'),
    suspiciousIpThrottling: path.join(directory, 'suspicious-ip-throttling.json'),
  };
}

function parse(context: DirectoryContext): ParsedAttackProtection {
  const files = attackProtectionFiles(context.filePath);

  if (!existsMustBeDir(files.directory)) {
    return {
      attackProtection: null,
    };
  }

  const breachedPasswordDetection = loadJSON(files.breachedPasswordDetection, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });
  const bruteForceProtection = loadJSON(files.bruteForceProtection, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });
  const suspiciousIpThrottling = loadJSON(files.suspiciousIpThrottling, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

  const attackProtection: AttackProtection = {
    breachedPasswordDetection,
    bruteForceProtection,
    suspiciousIpThrottling,
  };

  if (isFile(files.botDetection)) {
    attackProtection.botDetection = loadJSON(files.botDetection, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    });
  }

  if (isFile(files.captcha)) {
    attackProtection.captcha = loadJSON(files.captcha, {
      mappings: context.mappings,
      disableKeywordReplacement: context.disableKeywordReplacement,
    });
  }

  return {
    attackProtection,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { attackProtection } = context.assets;

  if (!attackProtection) return;

  const files = attackProtectionFiles(context.filePath);
  fs.ensureDirSync(files.directory);

  const maskedAttackProtection = attackProtectionDefaults(attackProtection);

  if (maskedAttackProtection.botDetection) {
    dumpJSON(files.botDetection, maskedAttackProtection.botDetection);
  }
  if (maskedAttackProtection.breachedPasswordDetection) {
    dumpJSON(files.breachedPasswordDetection, maskedAttackProtection.breachedPasswordDetection);
  }
  if (maskedAttackProtection.bruteForceProtection) {
    dumpJSON(files.bruteForceProtection, maskedAttackProtection.bruteForceProtection);
  }
  if (maskedAttackProtection.captcha) {
    dumpJSON(files.captcha, maskedAttackProtection.captcha);
  }
  if (maskedAttackProtection.suspiciousIpThrottling) {
    dumpJSON(files.suspiciousIpThrottling, maskedAttackProtection.suspiciousIpThrottling);
  }
}

const attackProtectionHandler: DirectoryHandler<ParsedAttackProtection> = {
  parse,
  dump,
};

export default attackProtectionHandler;
