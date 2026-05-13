export type Severity = 'critical' | 'high' | 'medium';

export type Finding = {
  rule: string;
  severity: Severity;
  resource: string;
  resourceName: string;
  message: string;
  fix: string;
};
