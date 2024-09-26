import { expect } from 'chai';
import Auth0 from '../../../src/tools/auth0';
import constants from '../../../src/tools/constants';
import { mockTheme } from './handlers/themes.tests';
import { mockPagedData } from '../../utils';

const mockConfigFn = () => { };

describe('#schema validation tests', () => {
  const client = {
    clients: {
      getAll: async (params) => mockPagedData(params, 'clients', []),
    },
    connections: {
      getAll: async (params) => mockPagedData(params, 'connections', []),
      _getRestClient: () => ({}),
    },
    resourceServers: {
      getAll: async (params) => mockPagedData(params, 'resource_servers', []),
    },
    clientGrants: {
      getAll: async (params) => mockPagedData(params, 'client_grants', []),
    },
    roles: {
      getAll: async (params) => mockPagedData(params, 'roles', []),
    },
    prompts: {
      _getRestClient: (endpoint) => ({
        get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
      }),
    },
  };

  const failedCb = (done) => (err) => done(err || 'test failed');

  const passedCb = (done, message, field) => (err) => {
    if (err || message) expect(err.message).to.contain(message);
    if (field) expect(err.message).to.contain(`properties/${field}/type`);
    done();
  };

  const checkPassed = (data, done) => {
    const auth0 = new Auth0(client, data, mockConfigFn);

    auth0.validate().then(passedCb(done), failedCb(done));
  };

  const checkRequired = (field, data, done) => {
    const auth0 = new Auth0(
      {
        prompts: {
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
      },
      data,
      mockConfigFn
    );

    auth0
      .validate()
      .then(failedCb(done), passedCb(done, `should have required property '${field}'`));
  };

  const checkEnum = (data, done) => {
    const auth0 = new Auth0(
      {
        prompts: {
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
      },
      data,
      mockConfigFn
    );

    auth0
      .validate()
      .then(failedCb(done), passedCb(done, 'should be equal to one of the allowed values'));
  };

  const checkTypeError = (field, expectedType, data, done) => {
    const auth0 = new Auth0(
      {
        prompts: {
          _getRestClient: (endpoint) => ({
            get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
          }),
        },
      },
      data,
      mockConfigFn
    );

    auth0.validate().then(failedCb(done), passedCb(done, `should be ${expectedType}`, field));
  };

  describe('#branding validate', () => {
    it('should fail validation if branding is not an object', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      const auth0 = new Auth0(
        {
          prompts: {
            _getRestClient: (endpoint) => ({
              get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
            }),
          },
        },
        { branding: data },
        mockConfigFn
      );

      auth0.validate().then(failedCb(done), passedCb(done, 'should be object'));
    });

    it('should pass validation', (done) => {
      const data = {
        anything: 'anything',
      };

      checkPassed({ branding: data }, done);
    });
  });

  describe('#clientGrants validate', () => {
    it('should fail validation if no "client_id" provided', (done) => {
      const data = [
        {
          name: 'name',
        },
      ];

      checkRequired('client_id', { clientGrants: data }, done);
    });

    it('should fail validation if no "scope" provided', (done) => {
      const data = [
        {
          client_id: 'client_id',
          audience: 'audience',
        },
      ];

      checkRequired('scope', { clientGrants: data }, done);
    });

    it('should fail validation if no "audience" provided', (done) => {
      const data = [
        {
          client_id: 'client_id',
          scope: ['scope'],
        },
      ];

      checkRequired('audience', { clientGrants: data }, done);
    });

    it('should fail validation if bad "scope" provided', (done) => {
      const data = [
        {
          client_id: 'client_id',
          scope: 'scope',
          audience: 'audience',
        },
      ];

      const auth0 = new Auth0(
        {
          prompts: {
            _getRestClient: (endpoint) => ({
              get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
            }),
          },
        },
        { clientGrants: data },
        mockConfigFn
      );

      auth0.validate().then(failedCb(done), passedCb(done, 'should be array'));
    });

    it('should pass validation', (done) => {
      const data = [
        {
          client_id: 'client_id',
          scope: ['scope'],
          audience: 'audience',
        },
      ];

      checkPassed({ clientGrants: data }, done);
    });
  });

  describe('#clients validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          id: 'id',
        },
      ];

      checkRequired('name', { clients: data }, done);
    });

    it('should fail validation if bad "name" provided', (done) => {
      const data = [
        {
          name: '',
        },
      ];

      const auth0 = new Auth0(
        {
          prompts: {
            _getRestClient: (endpoint) => ({
              get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
            }),
          },
        },
        { clients: data },
        mockConfigFn
      );

      auth0
        .validate()
        .then(failedCb(done), passedCb(done, 'should NOT be shorter than 1 characters'));
    });

    it('should pass validation', (done) => {
      const data = [
        {
          name: 'name',
        },
      ];

      checkPassed({ clients: data }, done);
    });
  });

  describe('#connections validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          id: 'id',
        },
      ];

      checkRequired('name', { connections: data }, done);
    });

    it('should fail validation if no "strategy" provided', (done) => {
      const data = [
        {
          name: 'name',
        },
      ];

      checkRequired('strategy', { connections: data }, done);
    });

    it('should pass validation', (done) => {
      const data = [
        {
          name: 'name',
          strategy: 'strategy',
        },
      ];

      checkPassed({ connections: data }, done);
    });
  });

  describe('#databases validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          id: 'id',
        },
      ];

      checkRequired('name', { databases: data }, done);
    });

    it('should fail validation if bad "strategy" provided', (done) => {
      const data = [
        {
          name: 'name',
          strategy: 'strategy',
        },
      ];

      checkEnum({ databases: data }, done);
    });

    it('should pass validation', (done) => {
      const data = [
        {
          name: 'name',
          options: {},
        },
      ];

      checkPassed({ databases: data }, done);
    });
  });

  describe('#emailProvider validate', () => {
    it('should fail validation if emailProvider is not an object', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      const auth0 = new Auth0(
        {
          prompts: {
            _getRestClient: (endpoint) => ({
              get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
            }),
          },
        },
        { emailProvider: data },
        mockConfigFn
      );

      auth0.validate().then(failedCb(done), passedCb(done, 'should be object'));
    });

    it('should pass validation', (done) => {
      const data = {
        anything: 'anything',
      };

      checkPassed({ emailProvider: data }, done);
    });
  });

  describe('#emailTemplates validate', () => {
    it('should fail validation if no "template" provided', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      checkRequired('template', { emailTemplates: data }, done);
    });

    it('should fail validation if bad "template" provided', (done) => {
      const data = [
        {
          template: 'template',
          body: 'body',
        },
      ];

      checkEnum({ emailTemplates: data }, done);
    });

    it('should pass validation', (done) => {
      const data = [
        {
          template: 'verify_email',
          body: 'body',
        },
      ];

      checkPassed({ emailTemplates: data }, done);
    });
  });

  describe('#guardianFactorProviders validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      checkRequired('name', { guardianFactorProviders: data }, done);
    });

    it('should fail validation if no "provider" provided', (done) => {
      const data = [
        {
          name: 'sms',
        },
      ];

      checkRequired('provider', { guardianFactorProviders: data }, done);
    });

    it('should fail validation if bad "name" provided', (done) => {
      const data = [
        {
          name: 'name',
          provider: 'provider',
        },
      ];

      checkEnum({ guardianFactorProviders: data }, done);
    });

    it('should fail validation if bad "provider" provided', (done) => {
      const data = [
        {
          name: 'sms',
          provider: 'provider',
        },
      ];

      checkEnum({ guardianFactorProviders: data }, done);
    });

    it('should pass validation', (done) => {
      const data = [
        {
          name: 'sms',
          provider: 'twilio',
        },
      ];

      checkPassed({ guardianFactorProviders: data }, done);
    });
  });

  describe('#guardianFactors validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      checkRequired('name', { guardianFactors: data }, done);
    });

    it('should fail validation if bad "name" provided', (done) => {
      const data = [
        {
          name: 'name',
        },
      ];

      checkEnum({ guardianFactors: data }, done);
    });

    constants.GUARDIAN_FACTORS.forEach((factorName) => {
      it(`should pass validation for ${factorName}`, (done) => {
        const data = [
          {
            name: factorName,
          },
        ];
        checkPassed({ guardianFactors: data }, done);
      });
    });
  });

  describe('#guardianFactorTemplates validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      checkRequired('name', { guardianFactorTemplates: data }, done);
    });

    it('should fail validation if bad "name" provided', (done) => {
      const data = [
        {
          name: 'name',
        },
      ];

      checkEnum({ guardianFactorTemplates: data }, done);
    });

    it('should pass validation', (done) => {
      const data = [
        {
          name: 'sms',
        },
      ];

      checkPassed({ guardianFactorTemplates: data }, done);
    });
  });

  describe('#guardianPolicies validate', () => {
    it('should fail validation if guardianPolicies is not an array of strings', (done) => {
      const data = {
        policies: 'all-applications',
      };

      checkTypeError('policies', 'array', { guardianPolicies: data }, done);
    });

    it('should pass validation', (done) => {
      const data = {
        policies: ['all-applications'],
      };

      checkPassed({ guardianPolicies: data }, done);
    });

    it('should allow empty array', (done) => {
      const data = {
        policies: [],
      };

      checkPassed({ guardianPolicies: data }, done);
    });
  });

  describe('#guardianPhoneFactorSelectedProvider validate', () => {
    it('should pass validation if no "provider" provided', (done) => {
      const data = {};

      checkPassed({ guardianPhoneFactorSelectedProvider: data }, done);
    });

    it('should pass validation', (done) => {
      const data = { provider: 'twilio' };

      checkPassed({ guardianPhoneFactorSelectedProvider: data }, done);
    });
  });

  describe('#guardianPhoneFactorMessageTypes validate', () => {
    it('should pass validation if no "message_types" provided', (done) => {
      const data = {};

      checkPassed({ guardianPhoneFactorMessageTypes: data }, done);
    });

    it('should pass validation', (done) => {
      const data = { message_types: ['sms', 'voice'] };

      checkPassed({ guardianPhoneFactorMessageTypes: data }, done);
    });
  });

  describe('#pages validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      checkRequired('name', { pages: data }, done);
    });

    it('should fail validation if bad "name" provided', (done) => {
      const data = [
        {
          name: 'name',
        },
      ];

      checkEnum({ pages: data }, done);
    });

    it('should pass validation for error_page', (done) => {
      const data = [
        { name: 'login' },
        {
          name: 'error_page',
          url: 'https://example.com/error',
          html: '<html>hello world</html>',
          show_log_link: true,
        },
      ];
      checkPassed({ pages: data }, done);
    });

    it('should fail validation for wrong url type in error_page', (done) => {
      const data = [
        {
          name: 'error_page',
          url: true,
          html: '<html>hello world</html>',
          show_log_link: true,
        },
      ];
      checkTypeError('url', 'string', { pages: data }, done);
    });

    it('should fail validation for wrong show_log_link type in error_page', (done) => {
      const data = [
        {
          name: 'error_page',
          url: 'https://example.com/error',
          html: '<html>hello world</html>',
          show_log_link: 1234,
        },
      ];
      checkTypeError('show_log_link', 'boolean', { pages: data }, done);
    });
  });

  describe('#prompts validate', () => {
    it('should fail validation if prompts is not an object', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      const auth0 = new Auth0(
        {
          prompts: {
            _getRestClient: (endpoint) => ({
              get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
            }),
          },
        },
        { prompts: data },
        mockConfigFn
      );

      auth0.validate().then(failedCb(done), passedCb(done, 'should be object'));
    });

    it('should pass validation', (done) => {
      const data = {
        anything: 'anything',
      };

      checkPassed({ prompts: data }, done);
    });
  });

  describe('#resourceServers validate', () => {
    it('should fail validation if no "name" provided', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      checkRequired('name', { resourceServers: data }, done);
    });

    it('should fail validation if no "identifier" provided', (done) => {
      const data = [
        {
          name: 'name',
        },
      ];

      checkRequired('identifier', { resourceServers: data }, done);
    });

    it('should pass validation', (done) => {
      const data = [
        {
          name: 'name',
          identifier: 'identifier',
        },
      ];

      checkPassed({ resourceServers: data }, done);
    });
  });

  describe('#tenant validate', () => {
    it('should fail validation if tenant is not an object', (done) => {
      const data = [
        {
          anything: 'anything',
        },
      ];

      const auth0 = new Auth0(
        {
          prompts: {
            _getRestClient: (endpoint) => ({
              get: (...options) => Promise.resolve({ endpoint, method: 'get', options }),
            }),
          },
        },
        { tenant: data },
        mockConfigFn
      );

      auth0.validate().then(failedCb(done), passedCb(done, 'should be object'));
    });

    it('should pass validation', (done) => {
      const data = {
        anything: 'anything',
      };

      checkPassed({ tenant: data }, done);
    });
  });

  describe('#themes validate', () => {
    it('should fail validation if themes is invalid', (done) => {
      const data = [
        {
          colors: true,
        },
      ];
      const auth0 = new Auth0(client, { themes: data }, mockConfigFn);

      auth0
        .validate()
        .then(failedCb(done), passedCb(done, "should have required property 'borders'"));
    });

    it('should pass validation', (done) => {
      const data = [mockTheme()];

      checkPassed({ themes: data }, done);
    });
  });
});
