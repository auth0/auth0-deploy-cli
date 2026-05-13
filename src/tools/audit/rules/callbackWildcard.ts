import { Assets } from '../../../types';
import { Finding } from '../types';

const LOCALHOST_PATTERN = /^https?:\/\/localhost/i;
const HTTP_PATTERN = /^http:\/\//i;
const WILDCARD_PATTERN = /\*/;

export function checkCallbackWildcard(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const clients = assets.clients || [];

  for (const client of clients) {
    const callbacks: string[] = client.callbacks || [];
    const logoutUrls: string[] = client.allowed_logout_urls || [];
    const origins: string[] = client.allowed_origins || [];
    const webOrigins: string[] = client.web_origins || [];

    // Check callbacks
    for (const url of callbacks) {
      if (WILDCARD_PATTERN.test(url)) {
        findings.push({
          rule: 'callback-wildcard',
          severity: 'critical',
          resource: 'clients',
          resourceName: String(client.name || 'unknown'),
          message: `Wildcard '${url}' in callbacks. Any domain can be used as a redirect target after login — open redirect vulnerability.`,
          fix: `Replace wildcard with explicit callback URLs for each environment.`,
        });
      } else if (HTTP_PATTERN.test(url) && !LOCALHOST_PATTERN.test(url)) {
        findings.push({
          rule: 'callback-http',
          severity: 'high',
          resource: 'clients',
          resourceName: String(client.name || 'unknown'),
          message: `Non-HTTPS callback URL '${url}' on client '${client.name}'. Auth codes and tokens can be intercepted in transit.`,
          fix: `Use HTTPS for all production callback URLs.`,
        });
      }
    }

    // Check logout URLs
    for (const url of logoutUrls) {
      if (WILDCARD_PATTERN.test(url)) {
        findings.push({
          rule: 'logout-url-wildcard',
          severity: 'high',
          resource: 'clients',
          resourceName: String(client.name || 'unknown'),
          message: `Wildcard '${url}' in allowed_logout_urls. Users can be redirected to any domain after logout.`,
          fix: `Replace wildcard with explicit allowed logout URLs.`,
        });
      }
    }

    // Check web origins
    for (const url of [...origins, ...webOrigins]) {
      if (WILDCARD_PATTERN.test(url)) {
        findings.push({
          rule: 'origin-wildcard',
          severity: 'high',
          resource: 'clients',
          resourceName: String(client.name || 'unknown'),
          message: `Wildcard '${url}' in allowed_origins/web_origins on client '${client.name}'. Any domain can make cross-origin requests.`,
          fix: `Replace wildcard with explicit origin URLs.`,
        });
      }
    }
  }

  return findings;
}
