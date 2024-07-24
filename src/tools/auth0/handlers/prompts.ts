import { isEmpty } from 'lodash';
import axios, { AxiosResponse } from 'axios';
import DefaultHandler from './default';
import { Assets, Language, languages } from '../../../types';
import log from '../../../logger';

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

const customPartialsPromptTypes = [
  'login',
  'login-id',
  'login-password',
  'signup',
  'signup-id',
  'signup-password',
] as const;

export type CustomPartialsPromptTypes = typeof customPartialsPromptTypes[number];

const customPartialsScreenTypes = [
  'login',
  'login-id',
  'login-password',
  'signup',
  'signup-id',
  'signup-password',
] as const;

export type CustomPartialsScreenTypes = typeof customPartialsPromptTypes[number];

const customPartialsInsertionPoints = [
  'form-content-start',
  'form-content-end',
  'form-footer-start',
  'form-footer-end',
  'secondary-actions-start',
  'secondary-actions-end',
] as const;

export type CustomPartialsInsertionPoints = typeof customPartialsInsertionPoints[number];

export type CustomPromptPartialsScreens = Partial<{
  [screen in CustomPartialsScreenTypes]: Partial<{
    [insertionPoint in CustomPartialsInsertionPoints]: string;
  }>;
}>;

export type CustomPromptPartials = Partial<{
  [prompt in CustomPartialsPromptTypes]: CustomPromptPartialsScreens;
}>;

export type CustomPartialsConfig = {
  [prompt in CustomPartialsPromptTypes]: [
    {
      name: string;
      template: string;
    }
  ];
};

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
      properties: languages.reduce((acc, language) => ({
        ...acc,
        [language]: {
          type: 'object',
          properties: promptTypes.reduce((acc, customPartialsPromptTypes) => ({
            ...acc,
            [customPartialsPromptTypes]: {
              type: 'object',
              properties: screenTypes.reduce((acc, screenTypes) => ({
                ...acc,
                [screenTypes]: {
                  type: 'object',
                },
              }), {}),
            },
          }), {}),
        },
      }), {}),
    },
    partials: {
      type: 'object',
      properties: customPartialsPromptTypes.reduce((acc, customPartialsPromptTypes) => ({
        ...acc,
        [customPartialsPromptTypes]: {
          type: 'object',
          properties: customPartialsScreenTypes.reduce((acc, customPartialsScreenTypes) => ({
            ...acc,
            [customPartialsScreenTypes]: {
              type: 'object',
              properties: customPartialsInsertionPoints.reduce((acc, customPartialsInsertionPoints) => ({
                ...acc,
                [customPartialsInsertionPoints]: {
                  type: 'string',
                },
              }), {}),
            },
          }), {}),
        },
      }), {}),
    }
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

export type AllPromptsByLanguage = Partial<{
  [key in Language]: Partial<PromptsCustomText>;
}>;

export type Prompts = Partial<
  PromptSettings & {
    customText: AllPromptsByLanguage;
    partials: CustomPromptPartials;
  }
>;

export default class PromptsHandler extends DefaultHandler {
  existing: Prompts;

  private IsFeatureSupported: boolean = true;

  /**
   * Returns formatted endpoint url.
   */
  private getPartialsEndpoint(promptType: CustomPartialsPromptTypes) {
    return `https://${this.config('AUTH0_DOMAIN')}/api/v2/prompts/${promptType}/partials`;
  }

  /**
   * Returns formatted endpoint url.
   */
  private putPartialsEndpoint(promptType: CustomPartialsPromptTypes) {
    return `https://${this.config('AUTH0_DOMAIN')}/api/v2/prompts/${promptType}/partials`;
  }

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'prompts',
    });
  }

  objString({ customText }: Prompts): string {
    return `Prompts settings${customText ? ' and prompts custom text' : ''}`;
  }

  async getType(): Promise<Prompts | null> {
    const promptsSettings = await this.client.prompts.getSettings();

    const customText = await this.getCustomTextSettings();

    const partials = await this.getCustomPromptsPartials();

    return {
      ...promptsSettings,
      customText,
      partials
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
      .then((customTextData) => customTextData
        .filter((customTextData) => customTextData !== null)
        .reduce((acc: AllPromptsByLanguage, customTextItem) => {
          if (customTextItem?.language === undefined) return acc;

          const { language, ...customTextSettings } = customTextItem;

          return {
            ...acc,
            [language]: acc[language]
              ? { ...acc[language], ...customTextSettings }
              : { ...customTextSettings },
          };
        }, {}));
  }

  private async partialHttpRequest(method: string, options: [string, ...Record<string, any>[]]): Promise<AxiosResponse> {
    return this.withErrorHandling(async () => {
      // @ts-ignore
      const accessToken = await this.client.tokenProvider?.getAccessToken();
      const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };
      options = [...options, { headers }];
      return axios[method](...options);
    },);
  }

  /**
   * Error handler wrapper.
   */
  async withErrorHandling(callback) {
    try {
      return await callback();
    } catch (error) {

      // Extract error data
      const errorData = error?.response?.data;
      if (errorData?.statusCode === 403) {
        log.warn('Partial Prompts feature is not supported for the tenant');
        this.IsFeatureSupported = false;
        return { data: null };
      }

      if (errorData?.statusCode === 400 && errorData?.message === 'This feature requires at least one custom domain to be configured for the tenant.') {
        log.warn('Partial Prompts feature requires at least one custom domain to be configured for the tenant');
        this.IsFeatureSupported = false;
        return { data: null };
      }
      throw error;
    }
  }

  async getCustomPartial({ prompt }: { prompt: CustomPartialsPromptTypes }): Promise<CustomPromptPartials> {
    if (!this.IsFeatureSupported) return {};
    const url = this.getPartialsEndpoint(prompt); // Implement this method to return the correct endpoint URL
    const response = await this.partialHttpRequest('get', [url]); // Implement this method for making HTTP requests
    return response.data;
  }

  async getCustomPromptsPartials(): Promise<CustomPromptPartials> {
    return this.client.pool
      .addEachTask({
        data: customPartialsPromptTypes.map((promptType) => ({ promptType })),
        generator: ({ promptType }) =>
          this.getCustomPartial({
            prompt: promptType,
          })
            .then((partialsData: CustomPromptPartials) => {
              if (isEmpty(partialsData)) return null;
              return {
                [promptType]: {
                  ...partialsData,
                },
              };
            }),
      })
      .promise()
      .then((partialsDataWithNulls) =>
        partialsDataWithNulls
          .filter(Boolean)
          .reduce(
            (
              acc: CustomPromptPartials,
              partialsData: { [prompt: string]: CustomPromptPartials }
            ) => {
              const [promptName] = Object.keys(partialsData);
              acc[promptName] = partialsData[promptName];
              return acc;
            },
            {}
          )
      );
  }

  async processChanges(assets: Assets): Promise<void> {
    const { prompts } = assets;

    if (!prompts) return;

    const { partials, customText, ...promptSettings } = prompts;

    if (!isEmpty(promptSettings)) {
      await this.client.prompts.updateSettings({}, promptSettings);
    }

    await this.updateCustomTextSettings(customText);
    await this.updateCustomPromptsPartials(partials);

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

  async updateCustomPartials({ prompt, body }: { prompt: CustomPartialsPromptTypes; body: CustomPromptPartialsScreens }): Promise<void> {
    if (!this.IsFeatureSupported) return;
    const url = this.putPartialsEndpoint(prompt); // Implement this method to return the correct endpoint URL
    await this.partialHttpRequest('put', [url, body]); // Implement this method for making HTTP requests
  }

  async updateCustomPromptsPartials(partials: Prompts['partials']): Promise<void> {
    /*
      Note: deletes are not currently supported
    */
    if (!partials) return;
    await this.client.pool
      .addEachTask({
        data: Object.keys(partials).map((prompt: CustomPartialsPromptTypes) => {
          const body = partials[prompt] || {};
          return {
            body,
            prompt,
          };
        }),
        generator: ({ prompt, body }) => this.updateCustomPartials({ prompt, body }),
      })
      .promise();
  }
}
