import { Assets } from '../../types';
import { Finding } from './types';
import { checkPasswordPolicy } from './rules/passwordPolicy';
import { checkRefreshTokens } from './rules/refreshTokens';
import { checkMfaDisabled } from './rules/mfaDisabled';
import { checkCallbackWildcard } from './rules/callbackWildcard';
import { checkClientGrantScopes } from './rules/clientGrantScopes';
import { checkTokenLifetime } from './rules/tokenLifetime';
import { checkBruteForceProtection } from './rules/bruteForceProtection';
import { checkBotAndCaptcha } from './rules/botAndCaptcha';
import { checkRiskAssessmentDisabled } from './rules/riskAssessmentDisabled';
import { checkLogStreamsEmpty } from './rules/logStreamsEmpty';
import { checkGuardianPolicyNotTenantWide } from './rules/guardianPolicyNotTenantWide';
import { checkLegacyGrantTypes } from './rules/legacyGrantTypes';
import { checkBreachedPasswordDetection } from './rules/breachedPasswordDetection';

export function runAuditChecks(assets: Assets): Finding[] {
  return [
    ...checkPasswordPolicy(assets),
    ...checkRefreshTokens(assets),
    ...checkMfaDisabled(assets),
    ...checkCallbackWildcard(assets),
    ...checkClientGrantScopes(assets),
    ...checkTokenLifetime(assets),
    ...checkBruteForceProtection(assets),
    ...checkBotAndCaptcha(assets),
    ...checkRiskAssessmentDisabled(assets),
    ...checkLogStreamsEmpty(assets),
    ...checkGuardianPolicyNotTenantWide(assets),
    ...checkLegacyGrantTypes(assets),
    ...checkBreachedPasswordDetection(assets),
  ];
}

export { Finding };
