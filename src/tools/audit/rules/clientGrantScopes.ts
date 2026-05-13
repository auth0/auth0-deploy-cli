import { Assets } from '../../../types';
import { Finding } from '../types';

// Scopes that grant destructive or admin-level access to the Management API
const SENSITIVE_SCOPES = [
  'delete:users',
  'delete:clients',
  'delete:connections',
  'delete:resource_servers',
  'delete:rules',
  'update:tenant_settings',
  'create:client_grants',
  'delete:client_grants',
  'read:logs',
  'read:logs_users',
  'blacklist:tokens',
];

// App types that are NOT machine-to-machine (should not have M2M grants)
const NON_M2M_APP_TYPES = ['spa', 'native', 'regular_web'];

export function checkClientGrantScopes(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const clientGrants = assets.clientGrants || [];
  const clients = assets.clients || [];

  // Build a map of client_id → client for quick lookup
  const clientMap = new Map(clients.map((c) => [String(c.client_id || ''), c]));

  for (const grant of clientGrants) {
    const scopes: string[] = grant.scope || [];
    const client = clientMap.get(String(grant.client_id || ''));
    const clientName = String(client?.name || grant.client_id || 'unknown');
    const appType = client?.app_type;

    // Flag sensitive scopes regardless of app type
    const sensitiveGranted = scopes.filter((s) => SENSITIVE_SCOPES.includes(s));
    if (sensitiveGranted.length > 0) {
      findings.push({
        rule: 'overly-broad-client-grant',
        severity: 'high',
        resource: 'clientGrants',
        resourceName: clientName ?? 'unknown',
        message:
          `Client '${clientName}' has been granted sensitive Management API scopes: [${sensitiveGranted.join(', ')}]. ` +
          `If this client is compromised, an attacker inherits these permissions.`,
        fix: `Remove unnecessary scopes. Apply the principle of least privilege — only grant scopes the client actively uses.`,
      });
    }

    // Flag allow_all_scopes — grants everything on the resource server
    if (grant.allow_all_scopes === true) {
      findings.push({
        rule: 'allow-all-scopes',
        severity: 'high',
        resource: 'clientGrants',
        resourceName: clientName ?? 'unknown',
        message: `Client '${clientName}' has allow_all_scopes enabled. It is granted every scope on the resource server, including any added in the future.`,
        fix: `Disable allow_all_scopes and explicitly list only the scopes this client needs.`,
      });
    }

    // Flag non-M2M clients with any Management API grant
    if (appType && NON_M2M_APP_TYPES.includes(appType) && grant.audience?.includes('/api/v2/')) {
      findings.push({
        rule: 'non-m2m-management-api-grant',
        severity: 'critical',
        resource: 'clientGrants',
        resourceName: clientName ?? 'unknown',
        message:
          `Client '${clientName}' is a ${appType} app with a Management API grant. ` +
          `Frontend/public clients should not call the Management API directly — this exposes admin operations to end users.`,
        fix: `Remove the Management API grant from this client. Use a backend service (non_interactive) to call the Management API instead.`,
      });
    }
  }

  return findings;
}
