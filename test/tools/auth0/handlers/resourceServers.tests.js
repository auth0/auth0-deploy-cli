const { expect } = require('chai');
const resourceServers = require('../../../../src/tools/auth0/handlers/resourceServers');

const pool = {
  addEachTask: (data) => {
    if (data.data && data.data.length) {
      data.generator(data.data[0]);
    }
    return { promise: () => null };
  }
};

describe('#resourceServers handler', () => {
  const config = function(key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: true
  };

  describe('#resourceServers validate', () => {
    it('should not allow same names', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someAPI'
        },
        {
          name: 'someAPI'
        }
      ];

      try {
        await stageFn.apply(handler, [ { resourceServers: data } ]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('Names must be unique');
      }
    });

    it('should not allow "Auth0 Management API" name', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'Auth0 Management API'
        }
      ];

      try {
        await stageFn.apply(handler, [ { resourceServers: data } ]);
      } catch (err) {
        expect(err).to.be.an('object');
        expect(err.message).to.include('You can not configure the \'Auth0 Management API\'.');
      }
    });

    it('should pass validation', async () => {
      const handler = new resourceServers.default({ client: {}, config });
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          name: 'someAPI'
        }
      ];

      await stageFn.apply(handler, [ { resourceServers: data } ]);
    });
  });

  describe('#resourceServers process', () => {
    it('should create resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: function(data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someAPI');
            return Promise.resolve(data);
          },
          update: () => Promise.resolve([]),
          delete: () => Promise.resolve([]),
          getAll: () => []
        },
        pool
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { resourceServers: [ { name: 'someAPI' } ] } ]);
    });

    it('should get resource servers', async () => {
      const auth0 = {
        resourceServers: {
          getAll: () => [
            { name: 'Auth0 Management API', identifier: 'https://test.auth0.com/api/v2/' },
            { name: 'Company API', identifier: 'http://company.com/api' }
          ]
        }
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const data = await handler.getType();
      expect(data).to.deep.equal([ { name: 'Company API', identifier: 'http://company.com/api' } ]);
    });

    it('should update resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function(params, data) {
            expect(params).to.be.an('object');
            expect(data).to.be.an('object');
            expect(params.id).to.equal('rs1');
            expect(data.scope).to.equal('new:scope');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          getAll: () => [ { id: 'rs1', identifier: 'some-api', name: 'someAPI' } ]
        },
        pool
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { resourceServers: [ { name: 'someAPI', identifier: 'some-api', scope: 'new:scope' } ] } ]);
    });

    it('should create new resource server with same name but different identifier', async () => {
      const auth0 = {
        resourceServers: {
          create: function(data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.name).to.equal('someAPI');
            expect(data.scope).to.equal('new:scope');
            expect(data.identifier).to.equal('another-api');
            return Promise.resolve(data);
          },
          update: function(params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be('undefined');
            expect(data).to.be('undefined');
            return Promise.resolve(data);
          },
          delete: () => Promise.resolve([]),
          getAll: () => [ { id: 'rs1', identifier: 'some-api', name: 'someAPI' } ]
        },
        pool
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { resourceServers: [ { name: 'someAPI', identifier: 'another-api', scope: 'new:scope' } ] } ]);
    });

    it('should remove resource server', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rs1');
            return Promise.resolve(data);
          },
          getAll: () => [ { id: 'rs1', identifier: 'some-api', name: 'someAPI' } ]
        },
        pool
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { resourceServers: [ {} ] } ]);
    });

    it('should remove all resource servers', async () => {
      let removed = false;
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rs1');
            removed = true;
            return Promise.resolve(data);
          },
          getAll: () => [ { id: 'rs1', identifier: 'some-api', name: 'someAPI' } ]
        },
        pool
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { resourceServers: [] } ]);
      expect(removed).to.equal(true);
    });

    it('should remove resource servers is run by extension', async () => {
      config.data = {
        EXTENSION_SECRET: 'some-secret'
      };

      let removed = false;
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: () => Promise.resolve([]),
          delete: (data) => {
            expect(data).to.be.an('object');
            expect(data.id).to.equal('rs1');
            removed = true;
            return Promise.resolve(data);
          },
          getAll: () => [ { id: 'rs1', identifier: 'some-api', name: 'someAPI' } ]
        },
        pool
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [ { resourceServers: [] } ]);
      expect(removed).to.equal(true);
    });

    it('should not touch excluded resource servers', async () => {
      const auth0 = {
        resourceServers: {
          create: () => Promise.resolve([]),
          update: function(data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          delete: (data) => {
            expect(data).to.be.an('undefined');
            return Promise.resolve(data);
          },
          getAll: () => [
            { id: 'rs1', identifier: 'some-api', name: 'someAPI' },
            { id: 'rs2', identifier: 'some-other-api', name: 'someOtherAPI' }
          ]
        },
        pool
      };

      const handler = new resourceServers.default({ client: auth0, config });
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const data = {
        resourceServers: [ { name: 'someAPI', identifier: 'some-api', scope: 'new:scope' } ],
        exclude: {
          resourceServers: [
            'someOtherAPI',
            'someAPI'
          ]
        }
      };

      await stageFn.apply(handler, [ data ]);
    });
  });
});
