import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkRiskAssessmentDisabled(assets: Assets): Finding[] {
  const riskAssessment = assets.riskAssessment;

  if (!riskAssessment || riskAssessment.settings?.enabled !== false) return [];

  return [
    {
      rule: 'risk-assessment-disabled',
      severity: 'high',
      resource: 'riskAssessment',
      resourceName: 'riskAssessment',
      message:
        'Risk assessment is disabled. Auth0 cannot detect impossible travel, new device logins, or velocity anomalies. ' +
        'In the 0ktapus campaign (2022), attackers compromised 130+ companies by replaying stolen OTP codes in real time — ' +
        'risk assessment would have re-challenged every one of those stolen sessions.',
      fix: 'Set riskAssessment.settings.enabled to true.',
    },
  ];
}
