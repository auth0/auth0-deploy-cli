import path from 'path';
import fs from 'fs-extra';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedAttackProtection = ParsedAsset<
  'attackProtection',
  {
    botDetection?: Asset | null;
    breachedPasswordDetection: Asset;
    bruteForceProtection: Asset;
    captcha?: Asset | null;
    suspiciousIpThrottling: Asset;
  }
>;

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

  const botDetection = loadJSON(files.botDetection, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });
  const breachedPasswordDetection = loadJSON(files.breachedPasswordDetection, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });
  const bruteForceProtection = loadJSON(files.bruteForceProtection, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });
  const captcha = loadJSON(files.captcha, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });
  const suspiciousIpThrottling = loadJSON(files.suspiciousIpThrottling, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

  return {
    attackProtection: {
      botDetection,
      breachedPasswordDetection,
      bruteForceProtection,
      captcha,
      suspiciousIpThrottling,
    },
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { attackProtection } = context.assets;

  if (!attackProtection) return;

  const files = attackProtectionFiles(context.filePath);
  fs.ensureDirSync(files.directory);

  if (attackProtection.botDetection) {
    dumpJSON(files.botDetection, attackProtection.botDetection);
  }
  dumpJSON(files.breachedPasswordDetection, attackProtection.breachedPasswordDetection);
  dumpJSON(files.bruteForceProtection, attackProtection.bruteForceProtection);
  if (attackProtection.captcha) {
    dumpJSON(files.captcha, attackProtection.captcha);
  }
  dumpJSON(files.suspiciousIpThrottling, attackProtection.suspiciousIpThrottling);
}

const attackProtectionHandler: DirectoryHandler<ParsedAttackProtection> = {
  parse,
  dump,
};

export default attackProtectionHandler;
