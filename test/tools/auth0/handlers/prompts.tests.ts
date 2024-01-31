import { expect } from 'chai';
import promptsHandler, { Prompts } from '../../../../src/tools/auth0/handlers/prompts';
import { Language } from '../../../../src/types';
import _ from 'lodash';
import { PromisePoolExecutor } from 'promise-pool-executor';

const mockPromptsSettings = {
  universal_login_experience: 'classic',
  identifier_first: true,
};

describe('#prompts handler', () => {
  describe('#prompts process', () => {
    it('should get prompts settings, custom texts and template partials', async () => {
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
      const templatePartials: Prompts['partials'] = {
        login: {
          login: {
            'form-content-start': '<div>TEST</div>',
          },
        },
        'signup-id': {
          'signup-id': {
            'form-content-start': '<div>TEST</div>',
          },
        },
      };

      const auth0 = {
        tenant: {
          getSettings: () =>
            Promise.resolve({
              enabled_locales: supportedLanguages,
            }),
        },
        prompts: {
          getSettings: () => mockPromptsSettings,
          getCustomTextByLanguage: ({ language, prompt }) => {
            const customTextLanguageMap = {
              en: englishCustomText,
              es: spanishCustomText,
              fr: frenchCustomText,
            };
            const customTextValue = customTextLanguageMap[language][prompt];

            if (customTextValue === undefined || _.isEmpty(customTextValue))
              return Promise.resolve({});

            return Promise.resolve(customTextValue);
          },
          getPartials: ({ prompt }) => Promise.resolve(_.cloneDeep(templatePartials[prompt])),
          updatePartials: ({ prompt }, body) => Promise.resolve(body),
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
        partials: templatePartials,
      });
    });

    it('should update prompts settings but not custom text/partials settings if not set', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;
      let didCallUpdatePartials = false;

      const auth0 = {
        tenant: {
          getSettings: () => ({
            enabled_locales: ['en'],
          }),
        },
        prompts: {
          updatePartials: () => {
            didCallUpdatePartials = true;
          },
          updateCustomTextByLanguage: () => {
            didCallUpdateCustomText = true;
          },
          updateSettings: (_params, data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve(data);
          },
        },
      };

      const handler = new promptsHandler({ client: auth0 });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      const customText = undefined;
      await stageFn.apply(handler, [{ prompts: { ...mockPromptsSettings, customText } }]);
      expect(didCallUpdatePromptsSettings).to.equal(true);
      expect(didCallUpdateCustomText).to.equal(false);
      expect(didCallUpdatePartials).to.equal(false);
    });

    it('should update prompts settings and custom text/partials settings when set', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;
      let didCallUpdatePartials = false;
      let numberOfUpdateCustomTextCalls = 0;
      let numberOfUpdatePartialsCalls = 0;

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

      const partialsToSet: Prompts['partials'] = {
        login: {
          login: {
            'form-content-start': '<div>TEST</div>',
          },
        },
        'signup-id': {
          'signup-id': {
            'form-content-start': '<div>TEST</div>',
          },
        },
        'signup-password': {
          'signup-password': {
            'form-content-start': '<div>TEST</div>',
          },
        },
      };

      const auth0 = {
        prompts: {
          updatePartials: () => {
            didCallUpdatePartials = true;
            numberOfUpdatePartialsCalls++;
            return Promise.resolve({});
          },
          updateCustomTextByLanguage: () => {
            didCallUpdateCustomText = true;
            numberOfUpdateCustomTextCalls++;
            return Promise.resolve({});
          },
          updateSettings: (_params, data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve(data);
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
        { prompts: { ...mockPromptsSettings, customText: customTextToSet, partials: partialsToSet } },
      ]);
      expect(didCallUpdatePromptsSettings).to.equal(true);
      expect(didCallUpdateCustomText).to.equal(true);
      expect(didCallUpdatePartials).to.equal(true);
      expect(numberOfUpdateCustomTextCalls).to.equal(3);
      expect(numberOfUpdatePartialsCalls).to.equal(3);
    });

    it('should not fail if tenant languages or partials are undefined', async () => {
      const auth0 = {
        tenant: {
          getSettings: () =>
            Promise.resolve({
              enabled_locales: undefined,
            }),
        },
        prompts: {
          getSettings: () => mockPromptsSettings,
          getPartials: async () => {},
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
        partials: {}, // Partials empty
      });
    });
  });
});
