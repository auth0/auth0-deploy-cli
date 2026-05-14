import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkLogStreamsEmpty(assets: Assets): Finding[] {
  const logStreams = assets.logStreams;

  if (logStreams && logStreams.length > 0) return [];

  return [
    {
      rule: 'log-streams-empty',
      severity: 'medium',
      resource: 'logStreams',
      resourceName: 'logStreams',
      message:
        'No log streams are configured. Auth0 events are not being forwarded to a SIEM (Splunk, Datadog, Sumo Logic, etc.). ' +
        'In the Okta Support System breach (Oct 2023), attackers accessed customer tenant data for weeks undetected — ' +
        'customers with no log streaming had zero real-time visibility.',
      fix: 'Configure at least one log stream under attackProtection > logStreams to forward events to your SIEM or logging platform.',
    },
  ];
}
