import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, loadJSON } from '../../../utils';
import { DirectoryHandler } from '.'
import DirectoryContext from '..';

type ParsedAttackProtection = {
  attackProtection: {
    breachedPasswordDetection: unknown
    bruteForceProtection: unknown
    suspiciousIpThrottling: unknown
  } | undefined
}


function attackProtectionFiles(filePath: string): {
  directory: string
  breachedPasswordDetection: string
  bruteForceProtection: string
  suspiciousIpThrottling: string
} {
  const directory = path.join(filePath, constants.ATTACK_PROTECTION_DIRECTORY);

  return {
    directory: directory,
    breachedPasswordDetection: path.join(directory, 'breached-password-detection.json'),
    bruteForceProtection: path.join(directory, 'brute-force-protection.json'),
    suspiciousIpThrottling: path.join(directory, 'suspicious-ip-throttling.json')
  };
}

function parse(context: DirectoryContext): ParsedAttackProtection {
  const files = attackProtectionFiles(context.filePath);

  if (!existsMustBeDir(files.directory)) {
    return {
      attackProtection: undefined
    };
  }

  const breachedPasswordDetection = loadJSON(files.breachedPasswordDetection);
  const bruteForceProtection = loadJSON(files.bruteForceProtection);
  const suspiciousIpThrottling = loadJSON(files.suspiciousIpThrottling);

  return {
    attackProtection: {
      breachedPasswordDetection,
      bruteForceProtection,
      suspiciousIpThrottling
    }
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { attackProtection } = context.assets;

  const files = attackProtectionFiles(context.filePath);
  fs.ensureDirSync(files.directory);

  dumpJSON(files.breachedPasswordDetection, attackProtection.breachedPasswordDetection);
  dumpJSON(files.bruteForceProtection, attackProtection.bruteForceProtection);
  dumpJSON(files.suspiciousIpThrottling, attackProtection.suspiciousIpThrottling);
}


const attackProtectionHandler: DirectoryHandler<ParsedAttackProtection> = {
  parse,
  dump,
}

export default attackProtectionHandler;