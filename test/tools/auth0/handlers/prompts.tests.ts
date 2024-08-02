import { expect } from 'chai';
import _ from 'lodash';
import { PromisePoolExecutor } from 'promise-pool-executor';
import sinon from 'sinon';
import promptsHandler, { Prompts } from '../../../../src/tools/auth0/handlers/prompts';
import { Language } from '../../../../src/types';
import log from '../../../../src/logger';
import {
  CustomPartialsPromptTypes,
  CustomPromptPartialsScreens,
} from '../../../../lib/tools/auth0/handlers/prompts';

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
      });

      const getCustomPartial = sinon.stub(handler, 'getCustomPartial');
      getCustomPartial.withArgs({ prompt: 'login' }).resolves(loginPartial);
      getCustomPartial.withArgs({ prompt: 'login-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup' }).resolves(signupPartial);

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
          updateCustomTextByLanguage: () => {
            didCallUpdateCustomText = true;
          },
          updateSettings: (_params, data) => {
            didCallUpdatePromptsSettings = true;
            expect(data).to.deep.equal(mockPromptsSettings);
            return Promise.resolve(data);
          },
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
      };

      const handler = new promptsHandler({
        client: auth0,
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
      });

      sinon.stub(handler, 'updateCustomPartials').callsFake(() => {
        didCallUpdatePartials = true;
        numberOfUpdatePartialsCalls++;
        return Promise.resolve({});
      });

      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          prompts: { ...mockPromptsSettings, customText: customTextToSet, partials: partialsToSet },
        },
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

      const handler = new promptsHandler({ client: auth0 });
      const getCustomPartial = sinon.stub(handler, 'getCustomPartial');
      getCustomPartial.withArgs({ prompt: 'login' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'login-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-password' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup-id' }).resolves({});
      getCustomPartial.withArgs({ prompt: 'signup' }).resolves({});

      const data = await handler.getType();
      expect(data).to.deep.equal({
        ...mockPromptsSettings,
        customText: {}, // Custom text empty
        partials: {}, // Partials empty
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

    it('should handle errors correctly in partialHttpRequest with Get Method', async () => {
      const method = 'get';
      const options = [{ prompt: 'test-prompt' }];
      const error = new Error('Request failed');
      sandbox.stub(handler.promptClient, method).rejects(error);

      try {
        await handler.partialHttpRequest(method, options);
        throw new Error('Expected method to throw.');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });

    it('should handle errors correctly in partialHttpRequest with Put Method', async () => {
      const method = 'put';
      const options = [{ prompt: 'test-prompt' }, { key: 'value' }];
      const error = new Error('Request failed');
      sandbox.stub(handler.promptClient, 'invoke').rejects(error);

      try {
        await handler.partialHttpRequest(method, options);
        throw new Error('Expected method to throw.');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });

    it('should make an HTTP request with the correct headers with Get Method', async () => {
      const method = 'get';
      const options = [{ prompt: 'test-prompt' }];
      const mockResponse = { data: 'response' };
      sandbox.stub(handler.promptClient, method).resolves(mockResponse);

      const result = await handler.partialHttpRequest(method, options);
      expect(result).to.deep.equal(mockResponse);
    });

    it('should make an HTTP request with the correct headers with Put Method', async () => {
      const method = 'put';
      const options = [{ prompt: 'test-prompt' }, { key: 'value' }];
      const mockResponse = { data: 'response' };
      sandbox.stub(handler.promptClient, 'invoke').resolves(mockResponse);

      const result = await handler.partialHttpRequest(method, options);
      expect(result).to.deep.equal(mockResponse);
    });

    it('should not make a request if the feature is not supported', async () => {
      handler.IsFeatureSupported = false;
      const putStub = sandbox.stub(handler, 'partialHttpRequest');

      await handler.updateCustomPartials({
        prompt: 'login',
        body: {} as CustomPromptPartialsScreens,
      });

      expect(putStub.called).to.be.false;
    });

    it('should make a request if the feature is supported', async () => {
      handler.IsFeatureSupported = true;
      const body = { key: 'value' };
      const putStub = sandbox.stub(handler, 'partialHttpRequest').resolves();

      await handler.updateCustomPartials({ prompt: 'login', body });

      expect(putStub.calledOnce).to.be.true;
      const { args } = putStub.getCall(0);
      expect(args[0]).to.equal('put');
      expect(args[1]).to.deep.equal([{ prompt: 'login' }, body]);
    });

    it('should return empty object if feature is not supported', async () => {
      handler.IsFeatureSupported = false;

      const result = await handler.getCustomPartial({
        prompt: 'login' as CustomPartialsPromptTypes,
      });
      expect(result).to.deep.equal({});
    });

    it('should return custom partial data if feature is supported', async () => {
      handler.IsFeatureSupported = true;

      const mockResponse = {
        'form-content-end': '<div>TEST</div>',
      };
      sandbox.stub(handler, 'partialHttpRequest').resolves(mockResponse);

      const result = await handler.getCustomPartial({ prompt: 'login' });

      expect(result).to.deep.equal(mockResponse);
      expect(handler.partialHttpRequest.calledOnceWith('get', [{ prompt: 'login' }])).to.be.true;
    });

    it('should handle errors correctly', async () => {
      handler.IsFeatureSupported = true;

      const error = new Error('Request failed');
      sandbox.stub(handler, 'partialHttpRequest').rejects(error);

      try {
        await handler.getCustomPartial({ prompt: 'login' as CustomPartialsPromptTypes });
        throw new Error('Expected method to throw.');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });
});
