import fs from 'fs-extra';
import path from 'path';
import { constants } from '../../../tools';
import { dumpJSON, existsMustBeDir, loadJSON } from '../../../utils';

function parse(context) {
  const attackProtectionFolder = path.join(context.filePath, constants.ATTACK_PROTECTION_DIRECTORY);

  if (!existsMustBeDir(attackProtectionFolder)) {
    return {
      breachedPasswordDetection: undefined,
      bruteForceProtection: undefined,
      suspiciousIpThrottling: undefined
    };
  }

  const breachedPasswordDetection = loadJSON(path.join(attackProtectionFolder, 'breached-password-detection.json'));
  const bruteForceProtection = loadJSON(path.join(attackProtectionFolder, 'brute-force-protection.json'));
  const suspiciousIpThrottling = loadJSON(path.join(attackProtectionFolder, 'suspicious-ip-throttling.json'));

  return {
    attackProtection: {
      breachedPasswordDetection,
      bruteForceProtection,
      suspiciousIpThrottling
    }
  };
}

async function dump(context) {
  const { attackProtection } = context.assets;

  // Create Attack Protection folder
  const attackProtectionFolder = path.join(context.filePath, constants.ATTACK_PROTECTION_DIRECTORY);
  fs.ensureDirSync(attackProtectionFolder);

  const breachedPasswordDetectionFile = path.join(attackProtectionFolder, 'breached-password-detection.json');
  const bruteForceProtectionFile = path.join(attackProtectionFolder, 'brute-force-protection.json');
  const suspiciousIpThrottlingFile = path.join(attackProtectionFolder, 'suspicious-ip-throttling.json');

  dumpJSON(breachedPasswordDetectionFile, attackProtection.breachedPasswordDetection);
  dumpJSON(bruteForceProtectionFile, attackProtection.bruteForceProtection);
  dumpJSON(suspiciousIpThrottlingFile, attackProtection.suspiciousIpThrottling);
}

export default {
  parse,
  dump
};
