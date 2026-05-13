import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkBruteForceProtection(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const attackProtection = assets.attackProtection;

  if (!attackProtection) return findings;

  const bfp = attackProtection.bruteForceProtection;

  if (bfp?.enabled === false) {
    findings.push({
      rule: 'brute-force-protection-disabled',
      severity: 'critical',
      resource: 'attackProtection',
      resourceName: 'bruteForceProtection',
      message:
        'Brute force protection is disabled. Attackers can make unlimited login attempts against any account with no lockout or throttling.',
      fix: `Set attackProtection.bruteForceProtection.enabled to true. Add 'block' and 'user_notification' to shields, and set a reasonable max_attempts (e.g. 10).`,
    });
  } else if (bfp?.enabled === true) {
    // Protection is on but shields might be misconfigured
    const shields: string[] = bfp.shields || [];
    if (!shields.includes('block')) {
      findings.push({
        rule: 'brute-force-protection-no-block',
        severity: 'high',
        resource: 'attackProtection',
        resourceName: 'bruteForceProtection',
        message:
          `Brute force protection is enabled but 'block' is not in shields. Suspicious IPs are detected but not blocked — attacks continue unimpeded.`,
        fix: `Add 'block' to attackProtection.bruteForceProtection.shields.`,
      });
    }

    const suspiciousIp = attackProtection.suspiciousIpThrottling;
    if (suspiciousIp?.enabled === false) {
      findings.push({
        rule: 'suspicious-ip-throttling-disabled',
        severity: 'high',
        resource: 'attackProtection',
        resourceName: 'suspiciousIpThrottling',
        message:
          'Suspicious IP throttling is disabled. Distributed credential stuffing attacks from multiple IPs are not throttled.',
        fix: `Set attackProtection.suspiciousIpThrottling.enabled to true.`,
      });
    }
  }

  return findings;
}
