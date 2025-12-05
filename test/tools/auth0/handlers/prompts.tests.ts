import { expect } from 'chai';
import _ from 'lodash';
import { PromisePoolExecutor } from 'promise-pool-executor';
import * as sinon from 'sinon';
import promptsHandler, { Prompts } from '../../../../src/tools/auth0/handlers/prompts';
import { Language } from '../../../../src/types';
import log from '../../../../src/logger';

const mockPromptsSettings = {
  universal_login_experience: 'classic',
  identifier_first: true,
};

describe('#prompts handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_EXPERIMENTAL_EA: true,
  };

  describe('#prompts process', () => {
    it('should get prompts settings, custom texts, template partials and screen renderer', async () => {
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

      const loginPartial = {
        login: {
          'form-content-end': '<div>TEST</div>',
        },
      };
      const signupPartial = {
        signup: {
          'form-content-end': '<div>TEST</div>',
        },
      };

      const sampleScreenRenderSignUp = {
        prompt: 'signup',
        screen: 'signup',
        rendering_mode: 'standard',
      };

      const sampleScreenRenderLogin = {
        prompt: 'login',
        screen: 'login',
        rendering_mode: 'advanced',
        default_head_tags_disabled: false,
        head_tags: [
          {
            tag: 'script',
            attributes: {
              src: 'URL_TO_YOUR_ASSET',
              async: true,
              defer: true,
              integrity: ['ASSET_SHA'],
            },
          },
        ],
        use_page_template: true,
        filters: {
          match_type: 'includes_any',
          clients: [
            {
              id: 'SeunfRe6p8EXxV6I0g9kMYdT1DxpfC38',
              metadata: {
                key1: 'value1',
              },
            },
          ],
        },
      };

      const auth0 = {
        tenants: {
          settings: {
            get: () =>
              Promise.resolve({
                enabled_locales: supportedLanguages,
              }),
          },
        },
        prompts: {
          getSettings: () => Promise.resolve(mockPromptsSettings),
          customText: {
            get: (prompt, language, _options) => {
              const customTextLanguageMap = {
                en: englishCustomText,
                es: spanishCustomText,
                fr: frenchCustomText,
              };
              const customTextForLanguage = customTextLanguageMap[language];
              if (!customTextForLanguage || !customTextForLanguage[prompt]) {
                return Promise.resolve({});
              }

              const customTextValue = customTextForLanguage[prompt]; // Get the wrapper object with prompt as key

              if (customTextValue === undefined || _.isEmpty(customTextValue))
                return Promise.resolve({});

              return Promise.resolve(customTextValue);
            },
          },
          rendering: {
            list: () => [sampleScreenRenderLogin, sampleScreenRenderSignUp],
          },
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      const handler = new promptsHandler({
        client: auth0,
        config: config,
      });

      const getCustomPartial = sinon.stub(handler, 'getCustomPartial');
      getCustomPartial.withArgs({ prompt: 'login' }).resolves(loginPartial);
      getCustomPartial.withArgs({ prompt: 'login-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-passwordless' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup' }).resolves(signupPartial);
      // Stub new prompts to return empty for retrieval test
      getCustomPartial.withArgs({ prompt: 'brute-force-protection' }).resolves({});

      const data = await handler.getType();
      expect(data).to.deep.equal({
        ...mockPromptsSettings,
        customText: {
          en: {
            'signup-password': englishCustomText['signup-password'],
            login: englishCustomText.login,
          },
          fr: {
            login: frenchCustomText.login,
          },
          // does not have spanish custom text because all responses returned empty objects
        },
        partials: {
          login: {
            login: loginPartial.login,
          },
          signup: {
            signup: signupPartial.signup,
          },
        },
        screenRenderers: [sampleScreenRenderLogin, sampleScreenRenderSignUp],
      });
      sinon.restore();
    });

    it('should get brute-force-protection custom texts along with others', async () => {
      const supportedLanguages: Language[] = ['en'];

      const englishCustomText = {
        login: {
          login: {
            description: 'login description in english',
            title: 'login title in english',
            buttonText: 'login button text in english',
          },
        },
        'brute-force-protection': {
          'brute-force-protection-unblock': {
            pageTitle: 'Unblock My Account here only',
            description: 'Unblock My Account here only',
            buttonText: 'Continue here only',
            logoAltText: 'only',
          },
          'brute-force-protection-unblock-success': {
            pageTitle: 'Account Unblocked Testing',
            eventTitle: 'Account Unblocked Titnasdasd',
            description: 'Your account has been unblocked Descriptiasd',
          },
          'brute-force-protection-unblock-failure': {
            pageTitle: 'Authentication Error testing',
            eventTitle: 'Authentication Error testing',
            expiredError: 'This link has expired. testing',
            usedError: 'This link can only be used once. testing.',
            genericError: 'Something went wrong, please try again later. testing',
          },
        },
      };

      const auth0 = {
        tenants: {
          settings: {
            get: () =>
              Promise.resolve({
                enabled_locales: supportedLanguages,
              }),
          },
        },
        prompts: {
          getSettings: () => Promise.resolve(mockPromptsSettings),
          customText: {
            get: (prompt, language, _options) => {
              const customTextLanguageMap = {
                en: {
                  login: englishCustomText.login,
                  'brute-force-protection': englishCustomText['brute-force-protection'],
                },
              };

              // Simulate fetching custom text for the specific prompt ('login' or 'brute-force-protection')
              const customTextForLanguage = customTextLanguageMap[language];

              if (!customTextForLanguage || !customTextForLanguage[prompt]) {
                return Promise.resolve({});
              }

              const customTextValue = customTextForLanguage[prompt];
              if (customTextValue === undefined || _.isEmpty(customTextValue))
                return Promise.resolve({});

              return Promise.resolve(customTextValue);
            },
          },
          rendering: {
            list: () => [],
          },
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      const handler = new promptsHandler({
        client: auth0,
        config: config,
      });

      const getCustomPartial = sinon.stub(handler, 'getCustomPartial');
      // Stub all partials to return empty for simplicity in this test
      getCustomPartial.resolves({});

      const data = await handler.getType();

      // The expected data should include the brute-force-protection custom texts
      expect(data).to.deep.equal({
        ...mockPromptsSettings,
        customText: {
          en: {
            login: englishCustomText.login,
            'brute-force-protection': englishCustomText['brute-force-protection'],
          },
        },
        partials: {},
        screenRenderers: [],
      });
      sinon.restore();
    });

    it('should update prompts settings but not custom text/partials settings if not set', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;
      let didCallUpdatePartials = false;

      const auth0 = {
        tenants: {
          settings: {
            get: () => ({
              enabled_locales: ['en'],
            }),
          },
        },
        prompts: {
          customText: {
            set: () => {
              didCallUpdateCustomText = true;
            },
          },
          updateSettings: (data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve({ data });
          },
          rendering: {
            update: () => {}, // Stub update since AUTH0_EXPERIMENTAL_EA is true by default here
          },
        },
      };

      const handler = new promptsHandler({
        client: auth0,
        config: config,
      });
      sinon.stub(handler, 'updateCustomPartials').callsFake(() => {
        didCallUpdatePartials = true;
        return Promise.resolve({});
      });

      const stageFn = handler.processChanges.bind(handler);
      const customText = undefined;
      await stageFn.apply(handler, [
        { prompts: { ...mockPromptsSettings, customText }, partials: undefined },
      ]);
      expect(didCallUpdatePromptsSettings).to.equal(true);
      expect(didCallUpdateCustomText).to.equal(false);
      expect(didCallUpdatePartials).to.equal(false);
      sinon.restore();
    });

    it('should update prompts settings and custom text/partials, screen renderer settings when set, including brute-force-protection', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;
      let didCallUpdatePartials = false;
      let numberOfUpdateCustomTextCalls = 0;
      let numberOfUpdatePartialsCalls = 0;
      let didCallUpdateScreenRenderer = false;

      const customTextToSet = {
        en: {
          login: {
            buttonText: 'button text2',
            description: 'description text',
            title: 'title text',
          },
          'brute-force-protection': {
            // Added brute-force-protection custom text
            'brute-force-protection-unblock': {
              pageTitle: 'Unblock My Account here only',
              description: 'Unblock My Account here only',
              buttonText: 'Continue here only',
            },
            'brute-force-protection-unblock-success': {
              pageTitle: 'Account Unblocked Testing',
            },
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
      const screenRenderersToSet: Prompts['screenRenderers'] = [
        {
          prompt: 'login',
          screen: 'login',
          rendering_mode: 'advanced',
          context_configuration: ['branding.settings', 'branding.themes.default'],
          default_head_tags_disabled: false,
          head_tags: [
            {
              tag: 'script',
              attributes: {
                src: 'URL_TO_YOUR_ASSET',
                async: true,
                defer: true,
                integrity: ['ASSET_SHA'],
              },
            },
          ],
        },
      ];

      const auth0 = {
        prompts: {
          customText: {
            set: (prompt, language, body) => {
              didCallUpdateCustomText = true;
              numberOfUpdateCustomTextCalls++;
              if (prompt === 'brute-force-protection') {
                expect(language).to.equal('en');
                // Check if the body contains the brute-force-protection screens
                expect(body).to.have.property('brute-force-protection-unblock');
                expect(body).to.have.property('brute-force-protection-unblock-success');
              }
              return Promise.resolve({ data: {} });
            },
          },
          updateSettings: (data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve({ data });
          },
          rendering: {
            update: () => {
              didCallUpdateScreenRenderer = true;
              return Promise.resolve({ data: {} });
            },
          },
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      const handler = new promptsHandler({
        client: auth0,
        config: config,
      });

      sinon.stub(handler, 'updateCustomPartials').callsFake(() => {
        didCallUpdatePartials = true;
        numberOfUpdatePartialsCalls++;
        return Promise.resolve({});
      });

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          prompts: {
            ...mockPromptsSettings,
            customText: customTextToSet,
            partials: partialsToSet,
            screenRenderers: screenRenderersToSet,
          },
        },
      ]);
      expect(didCallUpdatePromptsSettings).to.equal(true);
      expect(didCallUpdateCustomText).to.equal(true);
      expect(didCallUpdatePartials).to.equal(true);
      expect(didCallUpdateScreenRenderer).to.equal(true);
      // Expected calls: login (en), brute-force-protection (en), mfa-webauthn (en), login (fr)
      // Note: The total number of calls depends on how many unique prompt/language combinations are in customTextToSet.
      // In this case: (en/login), (en/brute-force-protection), (en/mfa-webauthn), (fr/login) = 4 calls
      expect(numberOfUpdateCustomTextCalls).to.equal(4);
      expect(numberOfUpdatePartialsCalls).to.equal(3); // Based on partialsToSet keys
      sinon.restore();
    });

    it('should update prompts settings and custom text/partials, not screen renderer settings when AUTH0_EXPERIMENTAL_EA=false', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;
      let didCallUpdatePartials = false;
      let numberOfUpdateCustomTextCalls = 0;
      let numberOfUpdatePartialsCalls = 0;
      let didCallUpdateScreenRenderer = false;

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
      const screenRenderersToSet: Prompts['screenRenderers'] = [];

      const auth0 = {
        prompts: {
          customText: {
            set: () => {
              didCallUpdateCustomText = true;
              numberOfUpdateCustomTextCalls++;
              return Promise.resolve({ data: {} });
            },
          },
          updateSettings: (data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve({ data });
          },
          rendering: {
            update: () => {
              didCallUpdateScreenRenderer = true;
              return Promise.resolve({ data: {} });
            },
          },
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      config.data.AUTH0_EXPERIMENTAL_EA = false;

      const handler = new promptsHandler({
        client: auth0,
        config: config,
      });

      sinon.stub(handler, 'updateCustomPartials').callsFake(() => {
        didCallUpdatePartials = true;
        numberOfUpdatePartialsCalls++;
        return Promise.resolve({});
      });

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          prompts: {
            ...mockPromptsSettings,
            customText: customTextToSet,
            partials: partialsToSet,
            screenRenderers: screenRenderersToSet,
          },
        },
      ]);
      expect(didCallUpdatePromptsSettings).to.equal(true);
      expect(didCallUpdateCustomText).to.equal(true);
      expect(didCallUpdatePartials).to.equal(true);
      expect(didCallUpdateScreenRenderer).to.equal(false);
      expect(numberOfUpdateCustomTextCalls).to.equal(3); // login-en, mfa-webauthn-en, login-fr
      expect(numberOfUpdatePartialsCalls).to.equal(3);
      config.data.AUTH0_EXPERIMENTAL_EA = true; // Reset config for subsequent tests
      sinon.restore();
    });

    it('should not fail if tenant languages or partials are undefined', async () => {
      const auth0 = {
        tenants: {
          settings: {
            get: () =>
              Promise.resolve({
                data: {
                  enabled_locales: undefined,
                },
              }),
          },
        },
        prompts: {
          getSettings: () => Promise.resolve(mockPromptsSettings),
          rendering: {
            list: () => [],
          },
        },
        pool: new PromisePoolExecutor({
          concurrencyLimit: 3,
          frequencyLimit: 1000,
          frequencyWindow: 1000, // 1 sec
        }),
      };

      config.data.AUTH0_EXPERIMENTAL_EA = true;

      const handler = new promptsHandler({ client: auth0, config: config });
      const getCustomPartial = sinon.stub(handler, 'getCustomPartial');
      getCustomPartial.withArgs({ prompt: 'login' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-passwordless' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'brute-force-protection' }).resolves({});

      const data = await handler.getType();
      expect(data).to.deep.equal({
        ...mockPromptsSettings,
        customText: {}, // Custom text empty
        partials: {}, // Partials empty
        screenRenderers: [],
      });
      sinon.restore();
    });
  });
  describe('withErrorHandling', () => {
    let handler: any;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      const auth0 = {
        tokenProvider: {
          getAccessToken: async function () {
            return 'test-access-token';
          },
        },
        prompts: {
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),

            invoke: (...options) => Promise.resolve({ endpoint, method: 'put', options }),
          }),
        },
      };
      handler = new promptsHandler({ client: auth0 });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should return the result of the callback', async () => {
      const callback = sandbox.stub().resolves('success');
      const result = await handler.withErrorHandling(callback);
      expect(result).to.equal('success');
    });

    it('should handle 403 error and set IsFeatureSupported to false', async () => {
      const error = {
        statusCode: 403,
      };
      const callback = sandbox.stub().rejects(error);
      const logWarn = sandbox.stub(log, 'warn');

      const result = await handler.withErrorHandling(callback);
      expect(result).to.deep.equal(null);
      expect(handler.IsFeatureSupported).to.be.false;
      expect(logWarn.calledWith('Partial Prompts feature is not supported for the tenant')).to.be
        .true;
    });

    it('should handle 400 error with specific message and set IsFeatureSupported to false', async () => {
      const error = {
        statusCode: 400,
        message:
          'This feature requires at least one custom domain to be configured for the tenant.',
      };
      const callback = sandbox.stub().rejects(error);
      const logWarn = sandbox.stub(log, 'warn');

      const result = await handler.withErrorHandling(callback);
      expect(result).to.deep.equal(null);
      expect(handler.IsFeatureSupported).to.be.false;
      expect(
        logWarn.calledWith(
          'Partial Prompts feature requires at least one custom domain to be configured for the tenant'
        )
      ).to.be.true;
    });

    it('should handle 429 error and log the appropriate message', async () => {
      const error = {
        statusCode: 429,
        message: 'Rate limit exceeded',
      };
      const callback = sandbox.stub().rejects(error);
      const logError = sandbox.stub(log, 'error');

      const result = await handler.withErrorHandling(callback);
      expect(result).to.be.null;
      expect(
        logError.calledWith(
          `The global rate limit has been exceeded, resulting in a ${error.statusCode} error. ${error.message}. Although this is an error, it is not blocking the pipeline.`
        )
      ).to.be.true;
    });

    it('should rethrow other errors', async () => {
      const error = new Error('some other error');
      const callback = sandbox.stub().rejects(error);

      try {
        await handler.withErrorHandling(callback);
        throw new Error('Expected method to throw.');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });

    it('should return empty object if feature is not supported', async () => {
      handler.IsFeatureSupported = false;

      const result = await handler.getCustomPartial({
        prompt: 'login',
      });
      expect(result).to.deep.equal({});
    });
  });
});
