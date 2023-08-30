import { expect } from 'chai';
import promptsHandler from '../../../../src/tools/auth0/handlers/prompts';
import { Language } from '../../../../src/types';
import _ from 'lodash';
import { PromisePoolExecutor } from 'promise-pool-executor';

const mockPromptsSettings = {
  universal_login_experience: 'classic',
  identifier_first: true,
};

describe('#prompts handler', () => {
  describe('#prompts process', () => {
    it('should get prompts settings and prompts custom text', async () => {
      const supportedLanguages: Language[] = ['es', 'fr', 'en'];

      const englishCustomText = {
        'signup-password': {
          'signup-password': {
            buttonText: 'signup password button text in english',
            description: 'signup password description in english',
            editEmailText: 'signup password edit in english',
          },
        },
        login: {
          login: {
            description: 'login description in english',
            title: 'login title in english',
            buttonText: 'login button text in english',
          },
        },
        'mfa-webauthn': {},
      };
      const frenchCustomText = {
        login: {
          login: {
            description: 'login description in french',
            title: 'login title in french',
            buttonText: 'login button text in french',
          },
        }, // Only has the single login prompt
        'signup-password': {},
        'mfa-webauthn': {},
      };
      const spanishCustomText = {
        login: {},
        'signup-password': {},
        'mfa-webauthn': {},
      }; // Has no prompts configured.

      const auth0 = {
        tenants: {
          getSettings: () =>
            Promise.resolve({ data: {
              enabled_locales: supportedLanguages,
            }}),
        },
        prompts: {
          get: () => ({ data: mockPromptsSettings }),
          getCustomTextByLanguage: ({ language, prompt }) => {
            const customTextLanguageMap = {
              en: englishCustomText,
              es: spanishCustomText,
              fr: frenchCustomText,
            };
            const customTextValue = customTextLanguageMap[language][prompt];

            if (customTextValue === undefined || _.isEmpty(customTextValue))
              return Promise.resolve({ data: {}});

            return Promise.resolve({ data: customTextValue });
          },
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      const handler = new promptsHandler({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        ...mockPromptsSettings,
        customText: {
          en: {
            'signup-password': englishCustomText['signup-password'],
            login: englishCustomText['login'],
          },
          fr: {
            login: frenchCustomText['login'],
          },
          //does not have spanish custom text because all responses returned empty objects
        },
      });
    });

    it('should update prompts settings but not custom text settings if not set', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;

      const auth0 = {
        tenants: {
          getSettings: () => ({
            enabled_locales: ['en'],
          }),
        },
        prompts: {
          updateCustomTextByLanguage: () => {
            didCallUpdateCustomText = true;
          },
          update: (data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve({ data });
          },
        },
      };

      const handler = new promptsHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const customText = undefined;
      await stageFn.apply(handler, [{ prompts: { ...mockPromptsSettings, customText } }]);
      expect(didCallUpdatePromptsSettings).to.equal(true);
      expect(didCallUpdateCustomText).to.equal(false);
    });

    it('should update prompts settings and custom text settings when both are set', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;
      let numberOfUpdateCustomTextCalls = 0;

      const customTextToSet = {
        en: {
          login: {
            buttonText: 'button text2',
            description: 'description text',
            title: 'title text',
          },
          'mfa-webauthn': {},
        },
        fr: {
          login: {
            buttonText: 'french button text',
            description: 'french description text',
            title: 'french title text',
          },
        },
      };

      const auth0 = {
        prompts: {
          updateCustomTextByLanguage: () => {
            didCallUpdateCustomText = true;
            numberOfUpdateCustomTextCalls++;
            return Promise.resolve({data: {}});
          },
          update: (data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve({ data });
          },
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      const handler = new promptsHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;


      await stageFn.apply(handler, [
        { prompts: { ...mockPromptsSettings, customText: customTextToSet } },
      ]);
      expect(didCallUpdatePromptsSettings).to.equal(true);
      expect(didCallUpdateCustomText).to.equal(true);
      expect(numberOfUpdateCustomTextCalls).to.equal(3);
    });

    it('should not fail if tenant languages undefined', async () => {
      const auth0 = {
        tenants: {
          getSettings: () =>
            Promise.resolve({
              data: {
                enabled_locales: undefined,
              }
            }),
        },
        prompts: {
          get: () => ({ data: mockPromptsSettings }),
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      const handler = new promptsHandler({ client: auth0 });
      const data = await handler.getType();
      expect(data).to.deep.equal({
        ...mockPromptsSettings,
        customText: {}, // Custom text empty
      });
    });
  });
});
