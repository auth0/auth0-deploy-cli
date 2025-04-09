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
      anonymous_proxy: true,
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
              anonymous_proxy: true,
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
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'network_acls', []),
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
          getAll: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleNetworkACL]);
    });

    it('should update networkACLs', async () => {
      const auth0 = {
        networkAcls: {
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleNetworkACL.id);
            expect(data).to.be.an('object');
            expect(data.description).to.equal(sampleNetworkACL.description);
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
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
            return Promise.resolve({ data });
          },
          delete: function (params) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleNetworkACL.id);
            return Promise.resolve({ data: [] });
          },
          update: function (params, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.be.a('string');
            expect(data).to.be.an('object');
            return Promise.resolve({ data });
          },
          getAll: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLs: [newNetworkACL] }]);
    });

    it('should delete all networkACLs', async () => {
      let removed = false;
      const auth0 = {
        networkAcls: {
          delete: function (params) {
            removed = true;
            (() => expect(this).to.not.be.undefined)();
            expect(params).to.be.an('object');
            expect(params.id).to.equal(sampleNetworkACL.id);
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLs: [] }]);
      expect(removed).to.equal(true);
    });

    it('should not remove networkACLs if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      const auth0 = {
        networkAcls: {
          delete: (params) => {
            expect(params).to.be.an('undefined');
            return Promise.resolve({ data: [] });
          },
          getAll: (params) => mockPagedData(params, 'network_acls', [sampleNetworkACL]),
        },
        pool,
      };

      const handler = new NetworkACLsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ networkACLs: [] }]);
    });
  });
});
