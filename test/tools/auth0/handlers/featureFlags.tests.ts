import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';

import FeatureFlagsHandler from '../../../../src/tools/auth0/handlers/featureFlags';
import pageClient from '../../../../src/tools/auth0/client';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000,
});

const sampleFlag = {
  id: 'flg_checkout_123',
  name: 'checkout-experiment',
  description: 'Controls the checkout experience',
  type: 'self',
  status: 'draft',
  parameters: {
    enabled: { type: 'boolean', value: false },
  },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// Auth0-managed built-in flag; must never be created/updated/deleted by the handler.
const managedFlag = {
  id: 'flg_a0_managed_passkey_enrollment',
  name: 'Passkey enrollment',
  type: 'auth0',
  status: 'active',
  parameters: {},
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function makePage(items: any[]) {
  return {
    data: items,
    hasNextPage: () => false,
    getNextPage: () =>
      Promise.resolve({
        data: [],
        hasNextPage: () => false,
        getNextPage: () => Promise.resolve({}),
      }),
  };
}

function makeClient(featureFlags: any) {
  return pageClient({ experimentation: { featureFlags }, pool } as any);
}

describe('#featureFlags handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };
  config.data = { AUTH0_ALLOW_DELETE: false };

  describe('#featureFlags validate', () => {
    it('should reject feature flags with duplicate names', async () => {
      const handler = new FeatureFlagsHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;

      try {
        await stageFn.apply(handler, [
          {
            featureFlags: [
              { name: 'dup', parameters: {} },
              { name: 'dup', parameters: {} },
            ],
          },
        ]);
        expect.fail('Should have thrown on duplicate names');
      } catch (err: any) {
        expect(err.message).to.include('Names must be unique');
      }
    });
  });

  describe('#featureFlags getType', () => {
    it('should list customer-defined flags', async () => {
      const handler = new FeatureFlagsHandler({
        client: makeClient({ list: () => Promise.resolve(makePage([sampleFlag])) }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleFlag]);
    });

    it('should exclude Auth0-managed (type: auth0) flags', async () => {
      const handler = new FeatureFlagsHandler({
        client: makeClient({ list: () => Promise.resolve(makePage([sampleFlag, managedFlag])) }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleFlag]);
    });
  });

  describe('#featureFlags processChanges', () => {
    it('should create a new feature flag and strip read-only / non-create fields', async () => {
      let created: any = null;
      const handler = new FeatureFlagsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([])),
          create: (data) => {
            created = data;
            return Promise.resolve({ ...data, id: 'flg_new' });
          },
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ featureFlags: [sampleFlag] }]);

      expect(created).to.not.equal(null);
      expect(created.name).to.equal(sampleFlag.name);
      // id / type / status / timestamps are not accepted on create (flag is born 'draft')
      expect(created).to.not.have.property('id');
      expect(created).to.not.have.property('type');
      expect(created).to.not.have.property('status');
      expect(created).to.not.have.property('created_at');
      expect(created).to.not.have.property('updated_at');
    });

    it('should update an existing flag and allow status transitions on update', async () => {
      let updatedId: string | null = null;
      let updatedData: any = null;
      const existing = { ...sampleFlag, status: 'draft' };
      const desired = { ...sampleFlag, status: 'active' };

      const handler = new FeatureFlagsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([existing])),
          update: (id, data) => {
            updatedId = id;
            updatedData = data;
            return Promise.resolve(data);
          },
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ featureFlags: [desired] }]);

      expect(updatedId).to.equal(sampleFlag.id);
      expect(updatedData.status).to.equal('active');
      // read-only fields stripped from the update payload
      expect(updatedData).to.not.have.property('type');
      expect(updatedData).to.not.have.property('created_at');
      expect(updatedData).to.not.have.property('updated_at');
    });

    it('should send only status for an archived flag so re-import is idempotent', async () => {
      let updatedData: any = null;
      const archived = { ...sampleFlag, status: 'archived' };
      const handler = new FeatureFlagsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([archived])),
          update: (id, data) => {
            updatedData = data;
            return Promise.resolve(data);
          },
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ featureFlags: [archived] }]);

      // archived flags are immutable; only the status is sent (no parameters/name), avoiding
      // feature_flag_archived on every re-import
      expect(updatedData).to.deep.equal({ status: 'archived' });
    });

    it('should delete a flag when AUTH0_ALLOW_DELETE is true', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      let deletedId: string | null = null;

      const handler = new FeatureFlagsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([sampleFlag])),
          delete: (id) => {
            deletedId = id;
            return Promise.resolve();
          },
          create: () => Promise.resolve({}),
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ featureFlags: [] }]);
      expect(deletedId).to.equal(sampleFlag.id);

      config.data.AUTH0_ALLOW_DELETE = false;
    });

    it('should never delete an Auth0-managed flag even when absent from config', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      let deleteCalled = false;

      const handler = new FeatureFlagsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([managedFlag])),
          delete: () => {
            deleteCalled = true;
            return Promise.resolve();
          },
          create: () => Promise.resolve({}),
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ featureFlags: [] }]);
      expect(deleteCalled).to.equal(false);

      config.data.AUTH0_ALLOW_DELETE = false;
    });

    it('should not delete a flag when AUTH0_ALLOW_DELETE is false', async () => {
      let deleteCalled = false;

      const handler = new FeatureFlagsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([sampleFlag])),
          delete: () => {
            deleteCalled = true;
            return Promise.resolve();
          },
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ featureFlags: [] }]);
      expect(deleteCalled).to.equal(false);
    });

    it('should do nothing when featureFlags is not set', async () => {
      const handler = new FeatureFlagsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([sampleFlag])),
          delete: () => Promise.reject(new Error('should not be called')),
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{}]);
    });
  });
});
