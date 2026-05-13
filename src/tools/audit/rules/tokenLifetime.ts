import { Assets } from '../../../types';
import { Finding } from '../types';

// Recommended maximums (in seconds)
const MAX_TOKEN_LIFETIME = 86400; // 24 hours — flag anything above this
const RECOMMENDED_TOKEN_LIFETIME = 3600; // 1 hour — what we suggest

export function checkTokenLifetime(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const clients = assets.clients || [];

  for (const client of clients) {
    const lifetime: number | undefined = client.token_endpoint_auth_method !== 'none'
      ? client.access_token_lifetime
      : undefined;

    // access_token_lifetime check
    if (client.access_token_lifetime && client.access_token_lifetime > MAX_TOKEN_LIFETIME) {
      findings.push({
        rule: 'token-lifetime-too-long',
        severity: 'medium',
        resource: 'clients',
        resourceName: client.name ?? 'unknown',
        message:
          `access_token_lifetime is ${client.access_token_lifetime}s (${Math.round(client.access_token_lifetime / 3600)}h) on client '${client.name}'. ` +
          `A stolen token remains valid for this entire duration.`,
        fix: `Set access_token_lifetime to ${RECOMMENDED_TOKEN_LIFETIME}s (1 hour) or less. Use refresh tokens to maintain sessions.`,
      });
    }
  }

  // Check tenant-level token lifetime
  const tenant = assets.tenant;
  if (tenant?.session_lifetime && tenant.session_lifetime > 72) {
    // session_lifetime is in hours
    findings.push({
      rule: 'session-lifetime-too-long',
      severity: 'medium',
      resource: 'tenant',
      resourceName: 'tenant',
      message: `Tenant session_lifetime is ${tenant.session_lifetime}h. Long sessions increase the risk window if a session is compromised.`,
      fix: `Consider reducing session_lifetime. NIST recommends re-authentication after no more than 12 hours of activity.`,
    });
  }

  return findings;
}
