import { expect } from 'chai';
import _ from 'lodash';
import { PromisePoolExecutor } from 'promise-pool-executor';
import sinon from 'sinon';
import promptsHandler, { Prompts } from '../../../../src/tools/auth0/handlers/prompts';
import { Language } from '../../../../src/types';
import log from '../../../../src/logger';
import { CustomPartialsPromptTypes } from '../../../../lib/tools/auth0/handlers/prompts';

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
      };

      const auth0 = {
        tenants: {
          getSettings: () =>
            Promise.resolve({
              data: {
                enabled_locales: supportedLanguages,
              },
            }),
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
              return Promise.resolve({ data: {} });

            return Promise.resolve({ data: customTextValue });
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
      getCustomPartial.withArgs({ prompt: 'login' }).resolves({ data: loginPartial });
      getCustomPartial.withArgs({ prompt: 'login-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-passwordless' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup' }).resolves({ data: signupPartial });

      const getPromptScreenSettings = sinon.stub(handler, 'getPromptScreenSettings');
      getPromptScreenSettings.resolves([sampleScreenRenderLogin, sampleScreenRenderSignUp]);

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
    });

    it('should update prompts settings but not custom text/partials settings if not set', async () => {
      let didCallUpdatePromptsSettings = false;
      let didCallUpdateCustomText = false;
      let didCallUpdatePartials = false;

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
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
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
    });

    it('should update prompts settings and custom text/partials, screen renderer settings when set', async () => {
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
          updateCustomTextByLanguage: () => {
            didCallUpdateCustomText = true;
            numberOfUpdateCustomTextCalls++;
            return Promise.resolve({ data: {} });
          },
          update: (data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve({ data });
          },
          updateRendering: () => {
            didCallUpdateScreenRenderer = true;
            return Promise.resolve({ data: {} });
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
      expect(numberOfUpdateCustomTextCalls).to.equal(3);
      expect(numberOfUpdatePartialsCalls).to.equal(3);
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
          updateCustomTextByLanguage: () => {
            didCallUpdateCustomText = true;
            numberOfUpdateCustomTextCalls++;
            return Promise.resolve({ data: {} });
          },
          update: (data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve({ data });
          },
          updateRendering: () => {
            didCallUpdateScreenRenderer = true;
            return Promise.resolve({ data: {} });
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
      expect(numberOfUpdateCustomTextCalls).to.equal(3);
      expect(numberOfUpdatePartialsCalls).to.equal(3);
    });

    it('should not fail if tenant languages or partials are undefined', async () => {
      const auth0 = {
        tenants: {
          getSettings: () =>
            Promise.resolve({
              data: {
                enabled_locales: undefined,
              },
            }),
        },
        prompts: {
          get: () => ({ data: mockPromptsSettings }),
          getSettings: () => mockPromptsSettings,
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
          getRendering: () => Promise.resolve({ data: {} }),
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

      const data = await handler.getType();
      expect(data).to.deep.equal({
        ...mockPromptsSettings,
        customText: {}, // Custom text empty
        partials: {}, // Partials empty
        screenRenderers: [],
      });
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
        prompt: 'login' as CustomPartialsPromptTypes,
      });
      expect(result).to.deep.equal({});
    });
  });
});
