//@ts-nocheck because prompts haven't been fully implemented in this codebase yet
import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';

export const schema = { type: 'object' };

const promptTypes = [
  'login',
  'login-id',
  'login-password',
  'login-email-verification',
  'signup',
  'signup-id',
  'signup-password',
  'reset-password',
  'consent',
  'mfa-push',
  'mfa-otp',
  'mfa-voice',
  'mfa-phone',
  'mfa-webauthn',
  'mfa-sms',
  'mfa-email',
  'mfa-recovery-code',
  'mfa',
  'status',
  'device-flow',
  'email-verification',
  'email-otp-challenge',
  'organizations',
  'invitation',
  'common',
];

type PromptSettings = {
  universal_login_experience?: 'new' | 'classic';
  webauthn_platform_first_factor?: boolean;
  identifier_first?: boolean;
  customText?: [];
};
export default class PromptsHandler extends DefaultHandler {
  existing: PromptSettings[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'prompts',
    });
  }

  async getType(): Promise<PromptSettings | null> {
    try {
      const promptsSettings = await this.client.prompts.getSettings();

      const customText = await this.getCustomTextSettings();

      return {
        ...promptsSettings,
        customText,
      };
    } catch (err) {
      if (err.statusCode === 404) return null;
      if (err.statusCode === 501) return null;

      throw err;
    }
  }

  async getCustomTextSettings(): Promise<{ [key: string]: Asset[] }> {
    const supportedLanguages = await this.client.tenant
      .getSettings()
      .then(({ enabled_locales }) => enabled_locales);

    return await Promise.all(
      supportedLanguages.flatMap((language) => {
        return promptTypes.map((promptType) => {
          return this.client.prompts
            .getCustomTextByLanguage({
              prompt: promptType,
              language,
            })
            .then((customTextData) => {
              if (Object.keys(customTextData).length === 0) return null;
              return {
                language,
                ...customTextData,
              };
            });
        });
      })
    ).then((customTextData: { language: string; [key: string]: Asset }[]) => {
      return customTextData
        .filter((customTextData) => customTextData !== null)
        .reduce((acc: { [key: string]: { [key: string]: Object } }, customTextItem) => {
          const { language, ...customTextSettings } = customTextItem;
          return {
            ...acc,
            [language]: !!acc[language]
              ? { ...acc[language], ...customTextSettings }
              : { ...customTextSettings },
          };
        }, {});
    });
  }

  async processChanges(assets: Assets): Promise<void> {
    const { prompts } = assets;
    // Do nothing if not set
    if (!prompts || !Object.keys(prompts).length) return;

    const { customText, ...promptSettings } = prompts;

    await this.client.prompts.updateSettings({}, promptSettings);

    const changes = calculateChanges({
      handler: this,
      assets: customText,
      existing: await this.getCustomTextSettings(),
      identifiers: ['id', 'name'],
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });

    this.updated += 1;
    this.didUpdate(prompts);
  }

  async updateCustomTextSettings(customText): Promise<void> {
    const supportedLanguages = await this.client.tenant
      .getSettings()
      .then(({ enabled_locales }) => enabled_locales);
  }
}
