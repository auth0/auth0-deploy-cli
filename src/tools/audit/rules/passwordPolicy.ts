import { Assets } from '../../../types';
import { Finding } from '../types';

// Minimum length implied by each Auth0 passwordPolicy level
const POLICY_MIN_LENGTH: Record<string, number> = {
  excellent: 8,
  good: 8,
  fair: 6,
  low: 1,
  none: 0,
};

// Fields that 'excellent' and 'good' require to be enabled
const POLICY_REQUIRES_HISTORY: string[] = ['excellent', 'good'];
const POLICY_REQUIRES_DICTIONARY: string[] = ['excellent', 'good'];
const POLICY_REQUIRES_NO_PERSONAL_INFO: string[] = ['excellent'];

export function checkPasswordPolicy(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const databases = assets.databases || [];

  for (const db of databases) {
    const options = db.options || {};
    const policy: string | undefined = options.passwordPolicy;

    if (!policy || policy === 'none' || policy === 'low') continue;

    const impliedMinLength = POLICY_MIN_LENGTH[policy] ?? 0;
    const actualMinLength: number | undefined = options.password_complexity_options?.min_length;

    if (actualMinLength !== undefined && actualMinLength < impliedMinLength) {
      findings.push({
        rule: 'password-policy-contradiction',
        severity: 'high',
        resource: 'databases',
        resourceName: db.name,
        message: `passwordPolicy is '${policy}' (implies min_length ≥ ${impliedMinLength}) but password_complexity_options.min_length is set to ${actualMinLength}.`,
        fix: `Set password_complexity_options.min_length to at least ${impliedMinLength} to match '${policy}' policy, or lower the passwordPolicy level.`,
      });
    }

    if (
      POLICY_REQUIRES_HISTORY.includes(policy) &&
      options.password_history?.enable === false
    ) {
      findings.push({
        rule: 'password-policy-contradiction',
        severity: 'high',
        resource: 'databases',
        resourceName: db.name,
        message: `passwordPolicy is '${policy}' (requires password history) but password_history.enable is false. Users can reuse the same password forever.`,
        fix: `Set password_history.enable to true and password_history.size to at least 5.`,
      });
    }

    if (
      POLICY_REQUIRES_DICTIONARY.includes(policy) &&
      options.password_dictionary?.enable === false
    ) {
      findings.push({
        rule: 'password-policy-contradiction',
        severity: 'high',
        resource: 'databases',
        resourceName: db.name,
        message: `passwordPolicy is '${policy}' (requires dictionary check) but password_dictionary.enable is false. Common passwords like 'password123' are accepted.`,
        fix: `Set password_dictionary.enable to true.`,
      });
    }

    if (
      POLICY_REQUIRES_NO_PERSONAL_INFO.includes(policy) &&
      options.password_no_personal_info?.enable === false
    ) {
      findings.push({
        rule: 'password-policy-contradiction',
        severity: 'medium',
        resource: 'databases',
        resourceName: db.name,
        message: `passwordPolicy is '${policy}' (requires no personal info) but password_no_personal_info.enable is false. Users can set their email address as their password.`,
        fix: `Set password_no_personal_info.enable to true.`,
      });
    }
  }

  return findings;
}
