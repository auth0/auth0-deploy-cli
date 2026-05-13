import { Assets } from '../../../types';
import { Finding } from '../types';

export function checkBotAndCaptcha(assets: Assets): Finding[] {
  const findings: Finding[] = [];
  const attackProtection = assets.attackProtection;

  if (!attackProtection) return findings;

  // Bot detection check
  const botDetection = attackProtection.botDetection;
  if (botDetection) {
    const level: string = botDetection.bot_detection_level;
    if (level === 'none') {
      findings.push({
        rule: 'bot-detection-off',
        severity: 'medium',
        resource: 'attackProtection',
        resourceName: 'botDetection',
        message:
          'Bot detection level is set to none. Automated bots can attempt logins without any challenge.',
        fix: `Set attackProtection.botDetection.bot_detection_level to 'low', 'medium', or 'high' depending on your risk tolerance.`,
      });
    }
  }

  // Captcha check — only flag if captcha object exists but has no active provider
  const captcha = attackProtection.captcha;
  if (captcha) {
    const activeProvider: string | undefined = captcha.active_provider_id;
    if (!activeProvider) {
      findings.push({
        rule: 'captcha-no-active-provider',
        severity: 'medium',
        resource: 'attackProtection',
        resourceName: 'captcha',
        message:
          'Captcha configuration exists but no active_provider_id is set. Captcha challenges will not be presented to users.',
        fix: `Set attackProtection.captcha.active_provider_id to one of: 'friendly_captcha', 'recaptcha_v2', 'recaptcha_enterprise', 'hcaptcha'.`,
      });
    }
  }

  return findings;
}
