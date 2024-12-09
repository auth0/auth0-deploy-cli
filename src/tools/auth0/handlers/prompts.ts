import { isEmpty } from 'lodash';
import {
  GetPartialsPromptEnum,
  GetRendering200Response,
  GetRenderingScreenEnum,
  PatchRenderingRequest,
  PatchRenderingRequestRenderingModeEnum,
  PutPartialsRequest,
} from 'auth0';
import DefaultHandler from './default';
import constants from '../../constants';
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
  'login-passwordless-email-code',
  'login-passwordless-email-link',
  'login-passwordless-sms-otp',
] as const;

export type ScreenTypes = typeof screenTypes[number];

const customPartialsPromptTypes = [
  'login',
  'login-id',
  'login-password',
  'login-passwordless',
  'signup',
  'signup-id',
  'signup-password',
];

export type CustomPartialsPromptTypes = typeof customPartialsPromptTypes[number];

const customPartialsScreenTypes = [
  'login',
  'login-id',
  'login-password',
  'signup',
  'signup-id',
  'signup-password',
  'login-passwordless-sms-otp',
  'login-passwordless-email-code',
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

export interface ScreenConfig {
  name: string;
  template: string;
}

export type CustomPartialsConfig = {
  [prompt in CustomPartialsPromptTypes]: [
    {
      [screen in CustomPartialsScreenTypes]: ScreenConfig[];
    }
  ];
};

export type PromptScreenRenderSettings = {
  name: string;
  body: string;
};

export type PromptScreenSettings = {
  [prompt in PromptTypes]: Partial<{
    [screen in ScreenTypes]: PromptScreenRenderSettings;
  }>;
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
      properties: languages.reduce(
        (acc, language) => ({
          ...acc,
          [language]: {
            type: 'object',
            properties: promptTypes.reduce(
              (promptAcc, promptType) => ({
                ...promptAcc,
                [promptType]: {
                  type: 'object',
                  properties: screenTypes.reduce(
                    (screenAcc, screenType) => ({
                      ...screenAcc,
                      [screenType]: {
                        type: 'object',
                      },
                    }),
                    {}
                  ),
                },
              }),
              {}
            ),
          },
        }),
        {}
      ),
    },
    partials: {
      type: 'object',
      properties: customPartialsPromptTypes.reduce(
        (acc, customPartialsPromptType) => ({
          ...acc,
          [customPartialsPromptType]: {
            oneOf: [
              {
                type: 'object',
                properties: customPartialsScreenTypes.reduce(
                  (screenAcc, customPartialsScreenType) => ({
                    ...screenAcc,
                    [customPartialsScreenType]: {
                      oneOf: [
                        {
                          type: 'object',
                          properties: customPartialsInsertionPoints.reduce(
                            (insertionAcc, customPartialsInsertionPoint) => ({
                              ...insertionAcc,
                              [customPartialsInsertionPoint]: {
                                type: 'string',
                              },
                            }),
                            {}
                          ),
                        },
                        { type: 'null' },
                      ],
                    },
                  }),
                  {}
                ),
              },
              { type: 'null' },
            ],
          },
        }),
        {}
      ),
    },
    screenRenderers: {
      type: 'array',
      properties: promptTypes.reduce(
        (promptAcc, promptType) => ({
          ...promptAcc,
          [promptType]: {
            type: 'array',
            properties: screenTypes.reduce(
              (screenAcc, screenType) => ({
                ...screenAcc,
                [screenType]: {
                  type: 'string',
                },
              }),
              {}
            ),
          },
        }),
        {}
      ),
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

export type AllPromptsByLanguage = Partial<{
  [key in Language]: Partial<PromptsCustomText>;
}>;

export type ScreenRenderer = Partial<GetRendering200Response>;

export type Prompts = Partial<
  PromptSettings & {
    customText: AllPromptsByLanguage;
    partials: CustomPromptPartials;
    screenRenderers?: ScreenRenderer[];
  }
>;

export default class PromptsHandler extends DefaultHandler {
  existing: Prompts;

  private IsFeatureSupported: boolean = true;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'prompts',
    });
  }

  objString({ customText, screenRenderers }: Prompts): string {
    let description = 'Prompts settings';
    if (customText) {
      description += ' and prompts custom text';
    }
    if (screenRenderers && screenRenderers.length > 0) {
      description += ' and screen renderers';
    }
    return description;
  }

  async getType(): Promise<Prompts | null> {
    const { data: promptsSettings } = await this.client.prompts.get();

    const customText = await this.getCustomTextSettings();

    const partials = await this.getCustomPromptsPartials();

    const prompts: Prompts = {
      ...promptsSettings,
      customText,
      partials,
    };

    try {
      const screenRenderers = await this.getPromptScreenSettings();
      prompts.screenRenderers = screenRenderers;
    } catch (error) {
      log.error(`Error fetching screen renderers: ${error}`);
    }

    return prompts;
  }

  async getCustomTextSettings(): Promise<AllPromptsByLanguage> {
    const supportedLanguages = await this.client.tenants
      .getSettings()
      .then(({ data: { enabled_locales } }) => {
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
            .then(({ data: customTextData }) => {
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
      .then((customTextData) =>
        customTextData
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
          }, {})
      );
  }

  /**
   * Error handler wrapper.
   */
  async withErrorHandling(callback) {
    try {
      return await callback();
    } catch (error) {
      // Extract error data
      if (error && error?.statusCode === 403) {
        log.warn('Partial Prompts feature is not supported for the tenant');
        this.IsFeatureSupported = false;
        return null;
      }

      if (
        error &&
        error?.statusCode === 400 &&
        error.message?.includes('feature requires at least one custom domain')
      ) {
        log.warn(
          'Partial Prompts feature requires at least one custom domain to be configured for the tenant'
        );
        this.IsFeatureSupported = false;
        return null;
      }

      if (error && error.statusCode === 429) {
        log.error(
          `The global rate limit has been exceeded, resulting in a ${error.statusCode} error. ${error.message}. Although this is an error, it is not blocking the pipeline.`
        );
        return null;
      }

      throw error;
    }
  }

  async getCustomPartial({
    prompt,
  }: {
    prompt: GetPartialsPromptEnum;
  }): Promise<CustomPromptPartials> {
    if (!this.IsFeatureSupported) return {};
    return this.withErrorHandling(async () => this.client.prompts.getPartials({ prompt }));
  }

  async getCustomPromptsPartials(): Promise<CustomPromptPartials> {
    const partialsDataWithNulls = await this.client.pool
      .addEachTask({
        data: customPartialsPromptTypes,
        generator: (promptType) =>
          this.getCustomPartial({
            prompt: promptType as GetPartialsPromptEnum,
          }).then((partialsData: CustomPromptPartials) => {
            if (isEmpty(partialsData?.data)) return null;
            return { promptType, partialsData: partialsData.data };
          }),
      })
      .promise();
    const validPartialsData = partialsDataWithNulls.filter(Boolean);
    return validPartialsData.reduce(
      (
        acc: CustomPromptPartials,
        partialData: { promptType: string; partialsData: CustomPromptPartials }
      ) => {
        if (partialData) {
          const { promptType, partialsData } = partialData;
          acc[promptType] = partialsData;
        }
        return acc;
      },
      {}
    );
  }

  async getPromptScreenSettings(): Promise<ScreenRenderer[]> {
    log.info('Loading Prompt Screen Renderers. This may take a while...');

    // Create combinations of prompt and screens
    const promptScreenCombinations = Object.entries(constants.PromptScreenMap).flatMap(
      ([promptType, screens]) =>
        screens.map((screen) => ({
          promptName: promptType,
          screenName: screen,
        }))
    );

    const renderSettings = await this.client.pool
      .addEachTask({
        data: promptScreenCombinations,
        generator: ({ promptName, screenName }) =>
          this.client.prompts
            .getRendering({
              prompt: promptName as GetPartialsPromptEnum,
              screen: screenName as GetRenderingScreenEnum,
            })
            .then(({ data: renderingSettings }) => {
              if (isEmpty(renderingSettings)) return null;
              return renderingSettings;
            }),
      })
      .promise();

    const customRenderingRes = renderSettings.filter((item) => item !== null);
    return customRenderingRes;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { prompts } = assets;

    if (!prompts) return;

    const { partials, customText, screenRenderers, ...promptSettings } = prompts;

    if (!isEmpty(promptSettings)) {
      await this.client.prompts.update(promptSettings);
    }

    await this.updateCustomTextSettings(customText);
    await this.updateCustomPromptsPartials(partials);

    // Update screen renderers
    await this.updateScreenRenderers(screenRenderers);

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
          this.client.prompts.updateCustomTextByLanguage({ prompt, language }, body),
      })
      .promise();
  }

  async updateCustomPartials({
    prompt,
    body,
  }: {
    prompt: CustomPartialsPromptTypes;
    body: CustomPromptPartialsScreens;
  }): Promise<void> {
    if (!this.IsFeatureSupported) return;
    await this.withErrorHandling(async () =>
      this.client.prompts.updatePartials({ prompt } as PutPartialsRequest, body)
    );
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

  async updateScreenRenderer(screenRenderer: ScreenRenderer): Promise<void> {
    const { prompt, screen, rendering_mode, tenant, ...updatePrams } = screenRenderer;

    if (!prompt || !screen) return;

    let updatePayload: PatchRenderingRequest = {};

    if (rendering_mode === PatchRenderingRequestRenderingModeEnum.standard) {
      updatePayload = {
        rendering_mode,
      };
    } else {
      updatePayload = {
        ...updatePrams,
      };
    }

    try {
      await this.client.prompts.updateRendering(
        {
          prompt: prompt as GetPartialsPromptEnum,
          screen: screen as GetRenderingScreenEnum,
        },
        {
          ...updatePayload,
        }
      );
    } catch (error) {
      const errorMessage = `Problem updating ${this.type} screen renderers  ${prompt}:${screen}\n${error}`;
      log.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async updateScreenRenderers(screenRenderers: Prompts['screenRenderers']): Promise<void> {
    if (isEmpty(screenRenderers) || !screenRenderers) return;

    await this.client.pool
      .addEachTask({
        data: screenRenderers,
        generator: (updateParams) => this.updateScreenRenderer(updateParams),
      })
      .promise();
  }
}
