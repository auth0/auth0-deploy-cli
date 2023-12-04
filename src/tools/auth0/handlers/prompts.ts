import DefaultHandler from './default';
import { Assets, Language, languages } from '../../../types';
import { isEmpty } from 'lodash';

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
] as const;

export type PromptTypes = typeof promptTypes[number];

const screenTypes = [
  'login',
  'login-id',
  'login-password',
  'login-email-verification',
  'signup',
  'signup-id',
  'signup-password',
  'reset-password-request',
  'reset-password-email',
  'reset-password',
  'reset-password-success',
  'reset-password-error',
  'consent',
  'status',
  'mfa-detect-browser-capabilities',
  'mfa-enroll-result',
  'mfa-login-options',
  'mfa-begin-enroll-options',
  'mfa-otp-enrollment-qr',
  'mfa-otp-enrollment-code',
  'mfa-otp-challenge',
  'mfa-voice-challenge',
  'mfa-sms-challenge',
  'mfa-recovery-code-enrollment',
  'mfa-recovery-code-challenge',
  'mfa-country-codes',
  'mfa-sms-enrollment',
  'mfa-voice-enrollment',
  'mfa-phone-challenge',
  'mfa-phone-enrollment',
  'mfa-webauthn-roaming-enrollment',
  'mfa-webauthn-platform-enrollment',
  'mfa-webauthn-platform-challenge',
  'mfa-webauthn-roaming-challenge',
  'mfa-webauthn-change-key-nickname',
  'mfa-webauthn-enrollment-success',
  'mfa-webauthn-error',
  'mfa-webauthn-not-available-error',
  'mfa-sms-list',
  'mfa-email-challenge',
  'mfa-email-list',
  'mfa-push-welcome',
  'mfa-push-list',
  'mfa-push-enrollment-qr',
  'mfa-push-enrollment-code',
  'mfa-push-success',
  'mfa-push-challenge-push',
  'device-code-activation',
  'device-code-activation-allowed',
  'device-code-activation-denied',
  'device-code-confirmation',
  'email-verification-result',
  'email-otp-challenge',
  'redeem-ticket',
  'organization-selection',
  'accept-invitation',
] as const;

export type ScreenTypes = typeof screenTypes[number];

export const schema = {
  type: 'object',
  properties: {
    universal_login_experience: {
      type: 'string',
      enum: ['new', 'classic'],
    },
    webauthn_platform_first_factor: {
      type: 'boolean',
    },
    identifier_first: {
      type: 'boolean',
    },
    customText: {
      type: 'object',
      properties: languages.reduce((acc, language) => {
        return {
          ...acc,
          [language]: {
            type: 'object',
            properties: promptTypes.reduce((acc, promptTypes) => {
              return {
                ...acc,
                [promptTypes]: {
                  type: 'object',
                  properties: screenTypes.reduce((acc, screenTypes) => {
                    return {
                      ...acc,
                      [screenTypes]: {
                        type: 'object',
                      },
                    };
                  }, {}),
                },
              };
            }, {}),
          },
        };
      }, {}),
    },
  },
};

export type PromptSettings = {
  universal_login_experience?: 'new' | 'classic';
  webauthn_platform_first_factor?: boolean;
  identifier_first?: boolean;
};

export type PromptsCustomText = {
  [key in PromptTypes]: Partial<{
    [key in ScreenTypes]: {
      [key: string]: string;
    };
  }>;
};

export type Prompts = Partial<
  PromptSettings & {
    customText: AllPromptsByLanguage;
  }
>;

export type AllPromptsByLanguage = Partial<{
  [key in Language]: Partial<PromptsCustomText>;
}>;

export default class PromptsHandler extends DefaultHandler {
  existing: Prompts;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'prompts',
    });
  }

  objString({ customText }: Prompts): string {
    return `Prompts settings${!!customText ? ' and prompts custom text' : ''}`;
  }

  async getType(): Promise<Prompts | null> {
    const promptsSettings = await this.client.prompts.getSettings();

    const customText = await this.getCustomTextSettings();

    return {
      ...promptsSettings,
      customText,
    };
  }

  async getCustomTextSettings(): Promise<AllPromptsByLanguage> {
    const supportedLanguages = await this.client.tenant
      .getSettings()
      .then(({ enabled_locales }) => {
        if (enabled_locales === undefined) return []; // In rare cases, private cloud tenants may not have `enabled_locales` defined
        return enabled_locales;
      });

    return this.client.pool
      .addEachTask({
        data:
          supportedLanguages
            .map((language) => promptTypes.map((promptType) => ({ promptType, language })))
            .reduce((acc, val) => acc.concat(val), []) || [],
        generator: ({ promptType, language }) =>
          this.client.prompts
            .getCustomTextByLanguage({
              prompt: promptType,
              language,
            })
            .then((customTextData) => {
              if (isEmpty(customTextData)) return null;
              return {
                language,
                [promptType]: {
                  ...customTextData,
                },
              };
            }),
      })
      .promise()
      .then((customTextData) => {
        return customTextData
          .filter((customTextData) => {
            return customTextData !== null;
          })
          .reduce((acc: AllPromptsByLanguage, customTextItem) => {
            if (customTextItem?.language === undefined) return acc;

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

    if (!prompts) return;

    const { customText, ...promptSettings } = prompts;

    if (!isEmpty(promptSettings)) {
      await this.client.prompts.updateSettings({}, promptSettings);
    }

    await this.updateCustomTextSettings(customText);

    this.updated += 1;
    this.didUpdate(prompts);
  }

  async updateCustomTextSettings(customText: Prompts['customText']): Promise<void> {
    /*
      Note: deletes are not currently supported
    */
    if (!customText) return;

    await this.client.pool
      .addEachTask({
        data: Object.keys(customText).flatMap((language: Language) => {
          const languageScreenTypes = customText[language];

          if (!languageScreenTypes) return [];

          return Object.keys(languageScreenTypes).map((prompt: PromptTypes) => {
            const body = languageScreenTypes[prompt] || {};
            return {
              body,
              language,
              prompt,
            };
          });
        }),
        generator: ({ prompt, language, body }) =>
          this.client.prompts.updateCustomTextByLanguage({
            prompt,
            language,
            body,
          }),
      })
      .promise();
  }
}
