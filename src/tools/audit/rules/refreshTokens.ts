import { Assets } from '../../../types';
import { Finding } from '../types';

// Public client types that cannot secure a client secret
const PUBLIC_APP_TYPES = ['spa', 'native'];

export function checkRefreshTokens(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const clients = assets.clients || [];

  for (const client of clients) {
    const rt = client.refresh_token;
    if (!rt) continue;

    const isNonExpiring = rt.expiration_type === 'non-expiring';
    const isNonRotating = rt.rotation_type === 'non-rotating';
    const isPublicClient = PUBLIC_APP_TYPES.includes(client.app_type as string);

    if (isNonExpiring && isNonRotating) {
      const severity = isPublicClient ? 'critical' : 'high';
      findings.push({
        rule: 'refresh-token-misconfiguration',
        severity,
        resource: 'clients',
        resourceName: client.name ?? 'unknown',
        message:
          `Refresh tokens are non-expiring and non-rotating${isPublicClient ? ` on a public ${client.app_type} client` : ''}. ` +
          `A stolen refresh token grants permanent access with no way to detect or invalidate it.`,
        fix: `Set refresh_token.expiration_type to 'expiring' and refresh_token.rotation_type to 'rotating'. ` +
          `Set refresh_token.token_lifetime and refresh_token.idle_token_lifetime to appropriate values (e.g. 2592000 / 1296000).`,
      });
    } else if (isNonExpiring && !isNonRotating) {
      findings.push({
        rule: 'refresh-token-misconfiguration',
        severity: 'medium',
        resource: 'clients',
        resourceName: client.name ?? 'unknown',
        message: `Refresh tokens are non-expiring on client '${client.name}'. Tokens never expire even if unused for long periods.`,
        fix: `Set refresh_token.expiration_type to 'expiring' and configure refresh_token.idle_token_lifetime.`,
      });
    }
  }

  return findings;
}
