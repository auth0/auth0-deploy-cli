import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';

import VariationsHandler from '../../../../src/tools/auth0/handlers/variations';
import pageClient from '../../../../src/tools/auth0/client';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000,
});

const selfFlag = { id: 'flg_self', name: 'checkout', type: 'self', status: 'active' };
const managedFlag = { id: 'flg_a0_managed', name: 'Passkey enrollment', type: 'auth0' };

const controlVariation = {
  id: 'var_control',
  feature_flag_id: 'flg_self',
  name: 'control',
  overrides: {},
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

function makeClient({ flags = [] as any[], variationsByFlag = {} as any, capture = {} as any }) {
  return pageClient({
    experimentation: {
      featureFlags: {
        list: () => Promise.resolve(makePage(flags)),
        variations: {
          list: (flagId: string) => Promise.resolve({ variations: variationsByFlag[flagId] || [] }),
          create: (flagId: string, body: any) => {
            capture.create = { flagId, body };
            return Promise.resolve({ ...body, id: 'var_new', feature_flag_id: flagId });
          },
          update: (flagId: string, vid: string, body: any) => {
            capture.update = { flagId, vid, body };
            return Promise.resolve({ ...body, id: vid });
          },
          delete: (flagId: string, vid: string) => {
            capture.delete = { flagId, vid };
            return Promise.resolve();
          },
        },
      },
    },
    pool,
  } as any);
}

describe('#variations handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };
  config.data = { AUTH0_ALLOW_DELETE: false };

  describe('#variations validate', () => {
    it('allows the same variation name under different flags', async () => {
      const handler = new VariationsHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;
      await stageFn.apply(handler, [
        {
          variations: [
            { feature_flag_name: 'checkout', name: 'control', overrides: {} },
            { feature_flag_name: 'signup', name: 'control', overrides: {} },
          ],
        },
      ]);
    });

    it('rejects duplicate variation names within the same flag', async () => {
      const handler = new VariationsHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;
      try {
        await stageFn.apply(handler, [
          {
            variations: [
              { feature_flag_name: 'checkout', name: 'control', overrides: {} },
              { feature_flag_name: 'checkout', name: 'control', overrides: { a: 1 } },
            ],
          },
        ]);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('unique within a feature flag');
      }
    });
  });

  describe('#variations getType', () => {
    it('lists variations by flag name, drops feature_flag_id, excludes managed-flag variations', async () => {
      const handler = new VariationsHandler({
        client: makeClient({
          flags: [selfFlag, managedFlag],
          variationsByFlag: {
            flg_self: [controlVariation],
            flg_a0_managed: [
              { id: 'var_m', feature_flag_id: 'flg_a0_managed', name: 'x', overrides: {} },
            ],
          },
        }),
        config,
      } as any);

      const data = await handler.getType();
      expect(data).to.have.length(1);
      expect(data[0].feature_flag_name).to.equal('checkout');
      expect(data[0]).to.not.have.property('feature_flag_id');
      expect(data[0].name).to.equal('control');
    });
  });

  describe('#variations processChanges', () => {
    it('creates a variation, resolving the flag name to id and stripping feature_flag_name', async () => {
      const capture: any = {};
      const handler = new VariationsHandler({
        client: makeClient({ flags: [selfFlag], variationsByFlag: {}, capture }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          variations: [
            { feature_flag_name: 'checkout', name: 'variant-a', overrides: { enabled: true } },
          ],
        },
      ]);

      expect(capture.create.flagId).to.equal('flg_self');
      expect(capture.create.body.name).to.equal('variant-a');
      expect(capture.create.body).to.not.have.property('feature_flag_name');
      expect(capture.create.body).to.not.have.property('id');
    });

    it('updates an existing variation matched by (flag, name)', async () => {
      const capture: any = {};
      const handler = new VariationsHandler({
        client: makeClient({
          flags: [selfFlag],
          variationsByFlag: { flg_self: [controlVariation] },
          capture,
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          variations: [{ feature_flag_name: 'checkout', name: 'control', overrides: { a: 1 } }],
        },
      ]);

      expect(capture.update.flagId).to.equal('flg_self');
      expect(capture.update.vid).to.equal('var_control');
      expect(capture.update.body.overrides).to.deep.equal({ a: 1 });
      expect(capture.update.body).to.not.have.property('feature_flag_name');
    });

    it('deletes a variation when AUTH0_ALLOW_DELETE is true, resolving the flag id from existing', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      const capture: any = {};
      const handler = new VariationsHandler({
        client: makeClient({
          flags: [selfFlag],
          variationsByFlag: { flg_self: [controlVariation] },
          capture,
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ variations: [] }]);

      expect(capture.delete.flagId).to.equal('flg_self');
      expect(capture.delete.vid).to.equal('var_control');
      config.data.AUTH0_ALLOW_DELETE = false;
    });

    it('throws a clear error when the referenced flag does not exist', async () => {
      const handler = new VariationsHandler({
        client: makeClient({ flags: [selfFlag], variationsByFlag: {} }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [
          { variations: [{ feature_flag_name: 'does-not-exist', name: 'v', overrides: {} }] },
        ]);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('not found');
      }
    });

    it('resolves a flag that only appears on a refresh (list read-after-write lag)', async () => {
      // The flag is absent on the first list (as if just created in the same run) and present
      // on the refresh, so create should still succeed.
      let listCalls = 0;
      const capture: any = {};
      const client = pageClient({
        experimentation: {
          featureFlags: {
            list: () => {
              listCalls += 1;
              return Promise.resolve(makePage(listCalls === 1 ? [] : [selfFlag]));
            },
            variations: {
              list: () => Promise.resolve({ variations: [] }),
              create: (flagId: string, body: any) => {
                capture.create = { flagId, body };
                return Promise.resolve({ ...body, id: 'var_new', feature_flag_id: flagId });
              },
            },
          },
        },
        pool,
      } as any);

      const handler = new VariationsHandler({ client, config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          variations: [
            { feature_flag_name: 'checkout', name: 'variant-a', overrides: { enabled: true } },
          ],
        },
      ]);

      expect(capture.create.flagId).to.equal('flg_self');
    });
  });
});
