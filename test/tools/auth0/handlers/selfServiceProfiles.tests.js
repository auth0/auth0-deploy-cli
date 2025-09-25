import { PromisePoolExecutor } from 'promise-pool-executor';
import { cloneDeep } from 'lodash';
import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const selfServiceProfiles = require('../../../../src/tools/auth0/handlers/selfServiceProfiles');
const { mockPagedData } = require('../../../utils');

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleSsProfileWithOutId = {
  name: 'test-self-service-profile',
  description: 'test Self-Service Profile',
  user_attributes: [
    {
      name: 'email',
      description: 'Email of the User',
      is_optional: false,
    },
    {
      name: 'name',
      description: 'Name of the User',
      is_optional: true,
    },
  ],
  allowed_strategies: ['adfs', 'google-apps', 'keycloak-samlp', 'oidc', 'okta', 'samlp', 'waad'],
  branding: { colors: { primary: '#19aecc' } },
};

const sampleCustomText = {
  introduction: 'Welcome! <p>test get-started introduction</p>',
};

const sampleSsProfileWithCustomText = {
  ...cloneDeep(sampleSsProfileWithOutId),
  customText: {
    en: {
      'get-started': sampleCustomText,
    },
  },
};

const sampleSsProfileWithId = {
  ...cloneDeep(sampleSsProfileWithOutId),
  id: 'ssp_yR1iy6ozRb3XBThacLpA9y',
};

const sampleUAP = {
  id: 'uap_yR1iy6ozRb3XBThacLpA9y',
  name: 'test user attribute profile',
  user_id: {
    oidc_mapping: 'sub',
    saml_mapping: ['urn:oasis:names:tc:SAML:2.0:attrname-format:basic'],
    scim_mapping: 'externalId',
  },
  user_attributes: {
    email: {
      description: 'Email of the User',
      label: 'Email',
      profile_required: true,
      auth0_mapping: 'email',
      oidc_mapping: {
        mapping: 'email',
        display_name: 'Email Address',
      },
      saml_mapping: ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
      scim_mapping: 'emails[primary eq true].value',
    },
    name: {
      description: 'Name of the User',
      label: 'Full Name',
      profile_required: false,
      auth0_mapping: 'name',
      oidc_mapping: {
        mapping: 'name',
      },
    },
  },
};

describe('#selfServiceProfiles handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#selfServiceProfiles validate', () => {
    it('should not allow same names', async () => {
      const handler = new selfServiceProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-selfServiceProfile',
        },
        {
          name: 'some-selfServiceProfile',
        },
      ];

      try {
        await stageFn.apply(handler, [{ selfServiceProfiles: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new selfServiceProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-selfServiceProfile',
        },
      ];

      await stageFn.apply(handler, [{ clients: data }]);
    });
  });

  describe('#selfServiceProfiles process', () => {
    it('should return empty if no selfServiceProfiles asset', async () => {
      const auth0 = {
        selfServiceProfiles: {},
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create selfServiceProfiles', async () => {
      const auth0 = {
        selfServiceProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleSsProfileWithOutId.name);
            expect(data.user_attributes).to.be.an('array');
            expect(data.allowed_strategies).to.be.an('array');
            expect(data.branding).to.be.an('object');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', []),
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          selfServiceProfiles: [sampleSsProfileWithOutId],
        },
      ]);
    });

    it('should create selfServiceProfiles with custom text', async () => {
      const auth0 = {
        selfServiceProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleSsProfileWithCustomText.name);
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', []),
          updateCustomText: (params, data) => {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.language).to.equal('en');
            expect(params.page).to.equal('get-started');
            expect(data).to.deep.equal(sampleCustomText);
            return Promise.resolve({ data: sampleCustomText });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          selfServiceProfiles: [sampleSsProfileWithCustomText],
        },
      ]);
    });

    it('should get selfServiceProfiles', async () => {
      const auth0 = {
        selfServiceProfiles: {
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sampleSsProfileWithId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({ data: [] });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleSsProfileWithId]);
    });

    it('should get selfServiceProfiles with custom_text', async () => {
      const sampleSsProfileWithCustomTextWithId = {
        ...cloneDeep(sampleSsProfileWithId),
        customText: {
          en: {
            'get-started': sampleCustomText,
          },
        },
      };
      const auth0 = {
        selfServiceProfiles: {
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sampleSsProfileWithId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({
              data: sampleCustomText,
            });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();

      expect(data).to.deep.equal([sampleSsProfileWithCustomTextWithId]);
    });

    it('should update selfServiceProfiles', async () => {
      const sampleFormUpdated = {
        ...cloneDeep(sampleSsProfileWithId),
        name: 'updated-selfServiceProfile',
      };

      const auth0 = {
        selfServiceProfiles: {
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleSsProfileWithId.id);
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleFormUpdated.name);

            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sampleSsProfileWithId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({
              data: sampleCustomText,
            });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          selfServiceProfiles: [sampleFormUpdated],
        },
      ]);
    });

    it('should update selfServiceProfiles with custom_text', async () => {
      const sampleFormUpdated = {
        ...cloneDeep(sampleSsProfileWithId),
        name: 'updated-selfServiceProfile',
        customText: {
          en: {
            'get-started': {
              introduction: 'Welcome! <p> Updated introduction</p>',
            },
          },
        },
      };

      const auth0 = {
        selfServiceProfiles: {
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleSsProfileWithId.id);
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleFormUpdated.name);
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sampleSsProfileWithId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({
              data: {},
            });
          },
          updateCustomText: (params, data) => {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.language).to.equal('en');
            expect(params.page).to.equal('get-started');
            expect(data).to.deep.equal({
              introduction: 'Welcome! <p> Updated introduction</p>',
            });
            return Promise.resolve({
              data,
            });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          selfServiceProfiles: [sampleFormUpdated],
        },
      ]);
    });

    it('should delete selfServiceProfiles and create another one instead', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;

      const sampleFormNew = {
        ...cloneDeep(sampleSsProfileWithOutId),
        name: 'new-selfServiceProfile',
      };

      const auth0 = {
        selfServiceProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleFormNew.name);
            return Promise.resolve({ data });
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleSsProfileWithId.id);
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sampleSsProfileWithId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({
              data: {},
            });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ selfServiceProfiles: [sampleFormNew] }]);
    });

    it('should delete all selfServiceProfiles', async () => {
      let removed = false;
      const auth0 = {
        selfServiceProfiles: {
          delete: (params) => {
            removed = true;
            expect(params).to.be.an('object');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sampleSsProfileWithId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({
              data: {},
            });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ selfServiceProfiles: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove selfServiceProfiles if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        selfServiceProfiles: {
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sampleSsProfileWithId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({
              data: {},
            });
          },
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ selfServiceProfiles: [] }]);
    });

    it('should convert user_attribute_profile name to id', async () => {
      const sspWithUserAttributesId = {
        ...cloneDeep(sampleSsProfileWithId),
        name: 'self-service-profile-with-uap-name',
        user_attribute_profile_id: sampleUAP.name,
        user_attributes: undefined,
      };
      const auth0 = {
        selfServiceProfiles: {
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'selfServiceProfiles', [sspWithUserAttributesId]),
          getCustomText: (params) => {
            expect(params).to.be.an('object');
            return Promise.resolve({
              data: {},
            });
          },
        },
        userAttributeProfiles: {
          getAll: (params) => mockPagedData(params, 'userAttributeProfiles', [sampleUAP]),
        },
        pool,
      };

      const handler = new selfServiceProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ selfServiceProfiles: [] }]);
    });
  });
});
