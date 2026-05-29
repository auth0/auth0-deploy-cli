import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';

import RateLimitPoliciesHandler from '../../../../src/tools/auth0/handlers/rateLimitPolicies';
import pageClient from '../../../../src/tools/auth0/client';
import { mockPagedData } from '../../../utils';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000, // 1 sec
});

const sampleRateLimitPolicy = {
  id: 'rlp_123',
  resource: 'oauth_authentication_api',
  consumer: 'client',
  consumer_selector: '*',
  configuration: {
    action: 'block',
    limit: 100,
  },
};

describe('#rateLimitPolicies handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#rateLimitPolicies validate', () => {
    it('should pass validation', async () => {
      const handler = new RateLimitPoliciesHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;
      const data = [
        {
          resource: 'oauth_authentication_api',
          consumer: 'client',
          consumer_selector: '*',
          configuration: {
            action: 'block',
            limit: 100,
          },
        },
      ];

      await stageFn.apply(handler, [{ rateLimitPolicies: data }]);
    });
  });

  describe('#rateLimitPolicies process', () => {
    it('should return empty if no rateLimitPolicies asset', async () => {
      const auth0 = {
        rateLimitPolicies: {},
        pool,
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      const response = await stageFn.apply(handler, [{}]);
      expect(response).to.equal(undefined);
    });

    it('should create rateLimitPolicies', async () => {
      const auth0 = {
        rateLimitPolicies: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.consumer_selector).to.equal(sampleRateLimitPolicy.consumer_selector);
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'rate_limit_policies', []),
        },
        pool,
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          rateLimitPolicies: [sampleRateLimitPolicy],
        },
      ]);
    });

    it('should get rateLimitPolicies', async () => {
      const auth0 = {
        rateLimitPolicies: {
          list: (params) => mockPagedData(params, 'rate_limit_policies', [sampleRateLimitPolicy]),
        },
        pool,
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleRateLimitPolicy]);
    });

    it('should handle 403 error when rate limit policies feature is not enabled', async () => {
      const auth0 = {
        rateLimitPolicies: {
          list: () => Promise.reject(Object.assign(new Error('Forbidden'), { statusCode: 403 })),
        },
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('should update rateLimitPolicies sending only configuration', async () => {
      const auth0 = {
        rateLimitPolicies: {
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleRateLimitPolicy.id);
            // PATCH should only contain configuration
            expect(data).to.deep.equal({ configuration: sampleRateLimitPolicy.configuration });
            expect(data).to.not.have.property('resource');
            expect(data).to.not.have.property('consumer');
            expect(data).to.not.have.property('consumer_selector');
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'rate_limit_policies', [sampleRateLimitPolicy]),
        },
        pool,
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          rateLimitPolicies: [sampleRateLimitPolicy],
        },
      ]);
    });

    it('should delete rateLimitPolicies and create another one instead', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;

      const newPolicy = {
        resource: 'oauth_authentication_api',
        consumer: 'client',
        consumer_selector: 'some-client-id',
        configuration: {
          action: 'allow',
        },
      };

      const auth0 = {
        rateLimitPolicies: {
          create: function (data) {
            (() => expect(this).to.not.be.undefined)();
            expect(data).to.be.an('object');
            expect(data.consumer_selector).to.equal(newPolicy.consumer_selector);
            return Promise.resolve(data);
          },
          delete: function (id) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleRateLimitPolicy.id);
            return Promise.resolve([]);
          },
          update: function (id, data) {
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(data).to.be.an('object');
            return Promise.resolve(data);
          },
          list: (params) => mockPagedData(params, 'rate_limit_policies', [sampleRateLimitPolicy]),
        },
        pool,
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rateLimitPolicies: [newPolicy] }]);
    });

    it('should not remove rateLimitPolicies if it is not allowed by config', async () => {
      config.data.AUTH0_ALLOW_DELETE = false;
      let isDeleteCalled = false;
      const auth0 = {
        rateLimitPolicies: {
          delete: (id) => {
            isDeleteCalled = true;
            expect(id).to.be.an('undefined');
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'rate_limit_policies', [sampleRateLimitPolicy]),
        },
        pool,
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rateLimitPolicies: [] }]);
      expect(isDeleteCalled).to.equal(false);
    });

    it('should delete all rateLimitPolicies', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      let removed = false;
      const auth0 = {
        rateLimitPolicies: {
          delete: function (id) {
            removed = true;
            (() => expect(this).to.not.be.undefined)();
            expect(id).to.be.a('string');
            expect(id).to.equal(sampleRateLimitPolicy.id);
            return Promise.resolve([]);
          },
          list: (params) => mockPagedData(params, 'rate_limit_policies', [sampleRateLimitPolicy]),
        },
        pool,
      };

      const handler = new RateLimitPoliciesHandler({
        client: pageClient(auth0 as any),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ rateLimitPolicies: [] }]);
      expect(removed).to.equal(true);
    });
  });
});
