import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkGuardianPolicyNotTenantWide(assets: Assets): Finding[] {
  const policies: string[] = assets.guardianPolicies?.policies || [];

  if (policies.includes('all-applications')) return [];

  return [
    {
      rule: 'guardian-policy-not-tenant-wide',
      severity: 'high',
      resource: 'guardianPolicies',
      resourceName: 'guardianPolicies',
      message:
        `Guardian MFA policy is set to '${policies.join(', ') || 'none'}' rather than 'all-applications'. ` +
        'Individual applications can opt out of MFA. ' +
        'Scattered Spider used this exact gap in the MGM Resorts breach (Sep 2023, ~$100M loss) — ' +
        'they targeted organisations where a single unprotected app bypassed tenant-wide MFA.',
      fix: "Set guardianPolicies.policies to ['all-applications'] to enforce MFA across every application with no exceptions.",
    },
  ];
}
