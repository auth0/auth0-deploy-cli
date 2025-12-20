import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';

import NetworkACLsHandler from '../../../../src/tools/auth0/handlers/networkACLs';
import pageClient from '../../../../src/tools/auth0/client';
import { mockPagedData } from '../../../utils';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleNetworkACL = {
  id: 'acl_123',
  description: 'Block Anonymous Proxies',
  active: true,
  priority: 1,
  rule: {
    action: {
      block: true,
    },
    scope: 'tenant',
    match: {
      asns: [12345],
    },
  },
};

describe('#networkACLs handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#networkACLs validate', () => {
    it('should pass validation', async () => {
      const handler = new NetworkACLsHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          description: 'Block Anonymous Proxies',
          active: true,
          priority: 1,
          rule: {
            action: {
              block: true,
            },
            scope: 'tenant',
            match: {
              asns: [12345],
            },
          },
        },
      ];

      await stageFn.apply(handler, [{ networkACLs: data }]);
    });
  });

  describe('#networkACLs process', () => {
    it('should return empty if no networkACLs asset', async () => {
      const auth0 = {
        networkACLs: {},
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create networkACLs', async () => {
      const auth0 = {
        networkAcls: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.description).to.equal(sampleNetworkACL.description);
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'network_acls', []),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          networkACLs: [sampleNetworkACL],
        },
      ]);
    });

    it('should get networkACLs', async () => {
      const auth0 = {
        networkAcls: {
          list: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleNetworkACL]);
    });

    it('should handle 403 error when tenant ACL Management is not enabled', async () => {
      const auth0 = {
        networkAcls: {
          list: () => Promise.reject(Object.assign(new Error('Forbidden'), { statusCode: 403 })),
        },
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('should update networkACLs', async () => {
      const auth0 = {
        networkAcls: {
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleNetworkACL.id);
            expect(data).to.be.an('object');
            expect(data.description).to.equal(sampleNetworkACL.description);
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          networkACLs: [sampleNetworkACL],
        },
      ]);
    });

    it('should delete networkACLs and create another one instead', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;

      const newNetworkACL = {
        description: sampleNetworkACL.description + ' new',
        active: true,
        priority: 2,
        rule: {
          action: {
            allow: true,
          },
          scope: 'authentication',
          match: {
            geo_country_codes: ['US', 'CA'],
          },
        },
      };

      const auth0 = {
        networkAcls: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.description).to.equal(newNetworkACL.description);
            return Promise.resolve(data);
          },
          delete: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleNetworkACL.id);
            return Promise.resolve([]);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(data).to.be.an('object');
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLs: [newNetworkACL] }]);
    });

    it('should not remove networkACLs if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      let idDeleteCalled = false;
      const auth0 = {
        networkAcls: {
          delete: (id) => {
            idDeleteCalled = true;
            expect(id).to.be.an('undefined');
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLs: [] }]);
      expect(idDeleteCalled).to.equal(false);
    });

    it('should delete all networkACLs', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      let removed = false;
      const auth0 = {
        networkAcls: {
          delete: function (id) {
            removed = true;
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleNetworkACL.id);
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLs: [] }]);
      expect(removed).to.equal(true);
    });
  });
});
