import DefaultHandler from './default';
import { Assets, Language } from '../../../types';

export const schema = { type: 'object' };

const promptScreenTypes = [
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

// convert namesArr into string literal union type
export type PromptScreenTypes = typeof promptScreenTypes[number];

export type PromptSettings = {
  universal_login_experience?: 'new' | 'classic';
  webauthn_platform_first_factor?: boolean;
  identifier_first?: boolean;
};

export type PromptsCustomText = {
  [key in PromptScreenTypes]: {
    [key: string]: string;
  };
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
      .then(({ enabled_locales }) => enabled_locales);

    const data = await Promise.all(
      supportedLanguages.flatMap((language) => {
        return promptScreenTypes.map((screenType) => {
          return this.client.prompts
            .getCustomTextByLanguage({
              prompt: screenType,
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
    ).then((customTextData) => {
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

    return data;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { prompts } = assets;

    if (!prompts) return;

    const { customText, ...promptSettings } = prompts;

    await this.client.prompts.updateSettings({}, promptSettings);

    await this.updateCustomTextSettings(customText);

    this.updated += 1;
    this.didUpdate(prompts);
  }

  async updateCustomTextSettings(customText: Prompts['customText']): Promise<void> {
    /*
      Note: deletes are not currently supported
    */
    if (!customText) return;

    await Promise.all(
      Object.keys(customText).flatMap((language: Language) => {
        const languageScreenTypes = customText[language];

        if (!languageScreenTypes) return [];

        return Object.keys(languageScreenTypes).map((prompt: PromptScreenTypes) => {
          const body = languageScreenTypes[prompt];
          return this.client.prompts.updateCustomTextByLanguage({
            prompt,
            language,
            //@ts-ignore
            body:
              {
                [prompt]: languageScreenTypes[prompt],
              } || {},
          });
        });
      })
    );
  }
}
