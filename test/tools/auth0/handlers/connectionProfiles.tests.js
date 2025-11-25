const { expect } = require('chai');
const connectionProfiles = require('../../../../src/tools/auth0/handlers/connectionProfiles');
const { mockPagedData } = require('../../../utils');
const pageClient = require('../../../../src/tools/auth0/client').default;

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  },
};

describe('#connectionProfiles handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true,
  };

  describe('#connectionProfiles validate', () => {
    it('should not allow same names', async () => {
      const handler = new connectionProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someProfile',
        },
        {
          name: 'someProfile',
        },
      ];

      try {
        await stageFn.apply(handler, [{ connectionProfiles: data }]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should pass validation', async () => {
      const handler = new connectionProfiles.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someProfile',
        },
      ];

      await stageFn.apply(handler, [{ connectionProfiles: data }]);
    });
  });

  describe('#connectionProfiles process', () => {
    it('should create connectionProfile', async () => {
      const auth0 = {
        connectionProfiles: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someProfile');
            return Promise.resolve({ data });
          },
          update: () => Promise.resolve({ data: [] }),
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) => mockPagedData(params, 'connectionProfiles', []),
        },
        pool,
      };

      const handler = new connectionProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ connectionProfiles: [{ name: 'someProfile' }] }]);
    });

    it('should update connectionProfile', async () => {
      const auth0 = {
        connectionProfiles: {
          create: () => Promise.resolve({ data: [] }),
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('cp_123');
            expect(data).to.be.an('object');
            expect(data.enabled_features).to.deep.equal(['scim']);
            return Promise.resolve({ data });
          },
          delete: () => Promise.resolve({ data: [] }),
          getAll: (params) =>
            mockPagedData(params, 'connectionProfiles', [
              { id: 'cp_123', name: 'someProfile', enabled_features: [] },
            ]),
        },
        pool,
      };

      const handler = new connectionProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        { connectionProfiles: [{ name: 'someProfile', enabled_features: ['scim'] }] },
      ]);
    });

    it('should delete connectionProfile', async () => {
      const auth0 = {
        connectionProfiles: {
          create: () => Promise.resolve({ data: [] }),
          update: () => Promise.resolve({ data: [] }),
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal('cp_123');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) =>
            mockPagedData(params, 'connectionProfiles', [{ id: 'cp_123', name: 'someProfile' }]),
        },
        pool,
      };

      const handler = new connectionProfiles.default({ client: pageClient(auth0), config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ connectionProfiles: [] }]);
    });
  });
});
