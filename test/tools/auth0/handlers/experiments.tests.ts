import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';

import ExperimentsHandler from '../../../../src/tools/auth0/handlers/experiments';
import pageClient from '../../../../src/tools/auth0/client';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000,
});

const flag = { id: 'flg_1', name: 'checkout', type: 'self' };
const variations = [
  { id: 'var_c', name: 'control' },
  { id: 'var_a', name: 'variant-a' },
];
const segment = { id: 'seg_1', name: 'us-visitors', type: 'self' };

// Shape as returned by the API list/get (names resolved, snapshots present).
const apiExperiment = {
  id: 'exp_1',
  name: 'checkout-test',
  feature_flag_id: 'flg_1',
  feature_flag_name: 'checkout',
  authentication_flow: 'authentication',
  allocation_strategy: 'percentage',
  status: 'draft',
  is_valid: true,
  editable_fields: ['name'],
  feature_flag_snapshot: { frozen: true },
  current_level: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  allocations: [
    {
      variation_id: 'var_c',
      variation_name: 'control',
      is_control: true,
      weight: 50,
      variation_snapshot: { x: 1 },
    },
    { variation_id: 'var_a', variation_name: 'variant-a', is_control: false, weight: 50 },
  ],
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

function makeClient({
  experiments = [] as any[],
  flags = [flag] as any[],
  variationsByFlag = { flg_1: variations } as any,
  segments = [segment] as any[],
  capture = {} as any,
}) {
  return pageClient({
    experimentation: {
      experiments: {
        list: () => Promise.resolve(makePage(experiments)),
        create: (body: any) => {
          capture.create = body;
          return Promise.resolve({ ...body, id: 'exp_new' });
        },
        update: (id: string, body: any) => {
          capture.update = { id, body };
          return Promise.resolve({ ...body, id });
        },
        delete: (id: string) => {
          capture.delete = id;
          return Promise.resolve();
        },
      },
      featureFlags: {
        list: () => Promise.resolve(makePage(flags)),
        variations: {
          list: (flagId: string) => Promise.resolve({ variations: variationsByFlag[flagId] || [] }),
        },
      },
      segments: { list: () => Promise.resolve(makePage(segments)) },
    },
    pool,
  } as any);
}

describe('#experiments handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };
  config.data = { AUTH0_ALLOW_DELETE: false };

  describe('#experiments getType', () => {
    it('strips tenant-specific ids and snapshots, keeps resolved names', async () => {
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [apiExperiment] }),
        config,
      } as any);
      const data = await handler.getType();
      const exp = data[0];
      expect(exp.feature_flag_name).to.equal('checkout');
      expect(exp).to.not.have.property('feature_flag_id');
      expect(exp).to.not.have.property('feature_flag_snapshot');
      expect(exp).to.not.have.property('is_valid');
      expect(exp).to.not.have.property('editable_fields');
      expect(exp.allocations[0].variation_name).to.equal('control');
      expect(exp.allocations[0]).to.not.have.property('variation_id');
      expect(exp.allocations[0]).to.not.have.property('variation_snapshot');
      expect(exp.allocations[0].weight).to.equal(50);
    });
  });

  describe('#experiments processChanges', () => {
    it('creates an experiment, resolving flag and allocation variation names to ids', async () => {
      const capture: any = {};
      const handler = new ExperimentsHandler({ client: makeClient({ capture }), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          experiments: [
            {
              name: 'new-exp',
              feature_flag_name: 'checkout',
              authentication_flow: 'authentication',
              allocation_strategy: 'percentage',
              status: 'active',
              allocations: [
                { variation_name: 'control', is_control: true, weight: 50 },
                { variation_name: 'variant-a', is_control: false, weight: 50 },
              ],
            },
          ],
        },
      ]);

      expect(capture.create.feature_flag_id).to.equal('flg_1');
      expect(capture.create).to.not.have.property('feature_flag_name');
      // status is not accepted on create (born draft)
      expect(capture.create).to.not.have.property('status');
      expect(capture.create.allocations[0].variation_id).to.equal('var_c');
      expect(capture.create.allocations[1].variation_id).to.equal('var_a');
      expect(capture.create.allocations[0]).to.not.have.property('variation_name');
    });

    it('resolves a segment-strategy allocation segment name to id', async () => {
      const capture: any = {};
      const handler = new ExperimentsHandler({ client: makeClient({ capture }), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          experiments: [
            {
              name: 'seg-exp',
              feature_flag_name: 'checkout',
              authentication_flow: 'authentication',
              allocation_strategy: 'segment',
              allocations: [
                { variation_name: 'control', is_control: true, is_fallback: true },
                {
                  variation_name: 'variant-a',
                  is_control: false,
                  segment_name: 'us-visitors',
                  priority: 1,
                },
              ],
            },
          ],
        },
      ]);

      expect(capture.create.allocations[1].segment_id).to.equal('seg_1');
      expect(capture.create.allocations[1]).to.not.have.property('segment_name');
      expect(capture.create.allocations[1].priority).to.equal(1);
    });

    it('updates an experiment, omits feature_flag_id, and sends a status transition', async () => {
      const capture: any = {};
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [apiExperiment], capture }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          experiments: [
            {
              id: 'exp_1',
              name: 'checkout-test',
              feature_flag_name: 'checkout',
              authentication_flow: 'authentication',
              status: 'active',
              allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
            },
          ],
        },
      ]);

      expect(capture.update.id).to.equal('exp_1');
      expect(capture.update.body).to.not.have.property('feature_flag_id');
      expect(capture.update.body.status).to.equal('active');
      expect(capture.update.body.allocations[0].variation_id).to.equal('var_c');
    });

    it('does not send status "draft" on update (not a valid transition target)', async () => {
      const capture: any = {};
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [apiExperiment], capture }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          experiments: [
            {
              id: 'exp_1',
              name: 'checkout-test',
              feature_flag_name: 'checkout',
              authentication_flow: 'authentication',
              status: 'draft',
              allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
            },
          ],
        },
      ]);

      expect(capture.update.body).to.not.have.property('status');
    });

    it('throws a clear error when the referenced flag does not exist', async () => {
      const handler = new ExperimentsHandler({
        client: makeClient({ flags: [] }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [
          {
            experiments: [
              {
                name: 'x',
                feature_flag_name: 'missing',
                authentication_flow: 'authentication',
              },
            ],
          },
        ]);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('not found');
      }
    });

    it('deletes an experiment when AUTH0_ALLOW_DELETE is true', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      const capture: any = {};
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [apiExperiment], capture }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ experiments: [] }]);
      expect(capture.delete).to.equal('exp_1');
      config.data.AUTH0_ALLOW_DELETE = false;
    });
  });
});
