import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkBreachedPasswordDetection(assets: Assets): Finding[] {
  const bpd = assets.attackProtection?.breachedPasswordDetection;

  if (!bpd || bpd.enabled !== false) return [];

  return [
    {
      rule: 'breached-password-detection-disabled',
      severity: 'high',
      resource: 'attackProtection',
      resourceName: 'breachedPasswordDetection',
      message:
        'Breached password detection is disabled. Auth0 will not check credentials against known breach databases (HaveIBeenPwned). ' +
        'Credentials leaked in past breaches — RockYou2021 (8.4B records), LinkedIn 2016, and hundreds of others — ' +
        'will work silently with no block and no alert.',
      fix: 'Set attackProtection.breachedPasswordDetection.enabled to true. Add shields: [block, admin_notification] to block and alert on compromised credential use.',
    },
  ];
}
