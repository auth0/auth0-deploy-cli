import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkMfaDisabled(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const connections = assets.connections || [];

  const passwordConnections = connections.filter(
    (c) => c.strategy === 'auth0' || c.strategy === 'google-apps' || c.strategy === 'waad'
  );

  for (const connection of passwordConnections) {
    const mfa = connection.options?.mfa;

    if (mfa && mfa.active === false) {
      findings.push({
        rule: 'mfa-disabled',
        severity: 'critical',
        resource: 'connections',
        resourceName: connection.name,
        message: `MFA is explicitly disabled on connection '${connection.name}' (strategy: ${connection.strategy}). Users can log in with only a password.`,
        fix: `Set options.mfa.active to true. Consider also enabling options.mfa.return_enroll_settings to prompt users to enroll.`,
      });
    }
  }

  // Also check databases (they have their own MFA-adjacent settings)
  const databases = assets.databases || [];
  for (const db of databases) {
    if (db.options?.mfa?.active === false) {
      findings.push({
        rule: 'mfa-disabled',
        severity: 'critical',
        resource: 'databases',
        resourceName: db.name,
        message: `MFA is explicitly disabled on database '${db.name}'. Users authenticate with password only.`,
        fix: `Set options.mfa.active to true.`,
      });
    }
  }

  return findings;
}
