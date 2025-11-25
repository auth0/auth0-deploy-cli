import { PromisePoolExecutor } from 'promise-pool-executor';
import { cloneDeep } from 'lodash';
import pageClient from '../../../../src/tools/auth0/client';

const { expect } = require('chai');
const userAttributeProfiles = require('../../../../src/tools/auth0/handlers/userAttributeProfiles');
const { mockPagedData } = require('../../../utils');

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleUAPWithoutId = {
  name: 'test-user-attribute-profile',
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

const sampleUAPWithId = {
  ...cloneDeep(sampleUAPWithoutId),
  id: 'uap_yR1iy6ozRb3XBThacLpA9y',
};

describe('#userAttributeProfiles handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#userAttributeProfiles validate', () => {
    it('should not allow same names', async () => {
      const handler = new userAttributeProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-userAttributeProfile',
        },
        {
          name: 'some-userAttributeProfile',
        },
      ];

      try {
        await stageFn.apply(handler, [{ userAttributeProfiles: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new userAttributeProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'some-userAttributeProfile',
        },
      ];

      await stageFn.apply(handler, [{ userAttributeProfiles: data }]);
    });
  });

  describe('#userAttributeProfiles process', () => {
    it('should return empty if no userAttributeProfiles asset', async () => {
      const auth0 = {
        userAttributeProfiles: {},
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create userAttributeProfiles', async () => {
      const auth0 = {
        userAttributeProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleUAPWithoutId.name);
            expect(data.user_id).to.be.an('object');
            expect(data.user_attributes).to.be.an('object');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'userAttributeProfiles', []),
        },
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          userAttributeProfiles: [sampleUAPWithoutId],
        },
      ]);
    });

    it('should get userAttributeProfiles', async () => {
      const auth0 = {
        userAttributeProfiles: {
          getAll: (params) => mockPagedData(params, 'userAttributeProfiles', [sampleUAPWithId]),
        },
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleUAPWithId]);
    });

    it('should get userAttributeProfiles with correct parameters', async () => {
      const auth0 = {
        userAttributeProfiles: {
          getAll: (params) => {
            expect(params).to.be.an('object');
            expect(params.include_totals).to.equal(true);
            expect(params.is_global).to.equal(false);
            return mockPagedData(params, 'userAttributeProfiles', [sampleUAPWithId]);
          },
        },
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      await handler.getType();
    });

    it('should update userAttributeProfiles', async () => {
      const sampleUAPUpdated = {
        ...cloneDeep(sampleUAPWithId),
        name: 'updated-userAttributeProfile',
      };

      const auth0 = {
        userAttributeProfiles: {
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleUAPWithId.id);
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleUAPUpdated.name);

            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'userAttributeProfiles', [sampleUAPWithId]),
        },
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          userAttributeProfiles: [sampleUAPUpdated],
        },
      ]);
    });

    it('should delete userAttributeProfiles and create another one instead', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;

      const sampleUAPNew = {
        ...cloneDeep(sampleUAPWithoutId),
        name: 'new-userAttributeProfile',
      };

      const auth0 = {
        userAttributeProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal(sampleUAPNew.name);
            return Promise.resolve({ data });
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleUAPWithId.id);
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'userAttributeProfiles', [sampleUAPWithId]),
        },
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ userAttributeProfiles: [sampleUAPNew] }]);
    });

    it('should delete all userAttributeProfiles', async () => {
      let removed = false;
      const auth0 = {
        userAttributeProfiles: {
          delete: (params) => {
            removed = true;
            expect(params).to.be.an('object');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'userAttributeProfiles', [sampleUAPWithId]),
        },
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ userAttributeProfiles: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove userAttributeProfiles if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        userAttributeProfiles: {
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'userAttributeProfiles', [sampleUAPWithId]),
        },
        pool,
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ userAttributeProfiles: [] }]);
    });

    it('should handle 403 error when not enabled on tenant', async () => {
      const auth0 = {
        userAttributeProfiles: {
          getAll: () => Promise.reject(Object.assign(new Error('Forbidden'), { statusCode: 403 })),
        },
      };

      const handler = new userAttributeProfiles.default({ client: pageClient(auth0), config });

      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });
  });
});
