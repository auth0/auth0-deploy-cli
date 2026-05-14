import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkLegacyGrantTypes(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const flags = assets.tenant?.flags;

  // Resource Owner Password Credential (ROPC) grant
  if (flags?.allow_legacy_ro_grant_types === true) {
    findings.push({
      rule: 'legacy-grant-ropc',
      severity: 'high',
      resource: 'tenant',
      resourceName: 'tenant.flags',
      message:
        'The Resource Owner Password Credential (ROPC) grant is enabled. ' +
        'ROPC sends the user\'s password directly to the application, bypassing Auth0\'s Universal Login and MFA entirely. ' +
        'It is deprecated in OAuth 2.1 and is the mechanism used in large-scale credential-stuffing attacks via phishing proxies.',
      fix: 'Set tenant.flags.allow_legacy_ro_grant_types to false. Migrate clients using ROPC to the authorization_code flow with PKCE.',
    });
  }

  // Implicit flow on any client
  const clients = assets.clients || [];
  for (const client of clients) {
    const grantTypes: string[] = client.grant_types || [];
    if (grantTypes.includes('implicit')) {
      findings.push({
        rule: 'legacy-grant-implicit',
        severity: 'high',
        resource: 'clients',
        resourceName: String(client.name ?? 'unknown'),
        message:
          `Client '${client.name}' has the implicit grant type enabled. ` +
          'Implicit flow delivers access tokens in URL fragments, which leak via Referer headers and browser history. ' +
          'It is removed in OAuth 2.1 (IETF BCP 212).',
        fix: "Remove 'implicit' from grant_types. Use authorization_code with PKCE instead.",
      });
    }
  }

  return findings;
}
