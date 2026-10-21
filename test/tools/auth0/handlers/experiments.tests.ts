import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';
import sinon from 'sinon';
import { ManagementError } from 'auth0';

import ExperimentsHandler from '../../../../src/tools/auth0/handlers/experiments';
import pageClient from '../../../../src/tools/auth0/client';
import log from '../../../../src/logger';

// A real not-entitled error as the auth0 v7 SDK throws it: the API code lives on `body.errorCode`.
const notEntitledError = () =>
  new ManagementError({
    message: 'feature not entitled',
    statusCode: 403,
    body: { errorCode: 'feature_not_entitled' },
  });

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
  editable_fields: ['name', 'description', 'default_config', 'allocations', 'levels'],
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

  afterEach(() => {
    sinon.restore();
    config.data.AUTH0_ALLOW_DELETE = false;
  });

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
      expect(exp).to.not.have.property('created_at');
      expect(exp).to.not.have.property('updated_at');
      expect(exp.allocations[0].variation_name).to.equal('control');
      expect(exp.allocations[0]).to.not.have.property('variation_id');
      expect(exp.allocations[0]).to.not.have.property('variation_snapshot');
      expect(exp.allocations[0].weight).to.equal(50);
    });

    it('returns null on 403 (tenant without the Experiment Center entitlement)', async () => {
      const client = pageClient({
        experimentation: {
          experiments: {
            list: () => Promise.reject(Object.assign(new Error('forbidden'), { statusCode: 403 })),
          },
        },
        pool,
      } as any);
      const handler = new ExperimentsHandler({ client, config } as any);
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('returns null on 404', async () => {
      const client = pageClient({
        experimentation: {
          experiments: {
            list: () => Promise.reject(Object.assign(new Error('not found'), { statusCode: 404 })),
          },
        },
        pool,
      } as any);
      const handler = new ExperimentsHandler({ client, config } as any);
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('rethrows a missing-scope 403 so the base scope warning still fires', async () => {
      const client = pageClient({
        experimentation: {
          experiments: {
            list: () =>
              Promise.reject(
                Object.assign(
                  new Error('Insufficient scope, expected any of: read:experimentation'),
                  { statusCode: 403 }
                )
              ),
          },
        },
        pool,
      } as any);
      const handler = new ExperimentsHandler({ client, config } as any);
      try {
        await handler.getType();
        expect.fail('Should have rethrown the insufficient-scope error');
      } catch (err: any) {
        expect(err.message).to.include('Insufficient scope');
      }
    });

    it('throws a clear error when the list omits feature_flag_name (not re-importable)', async () => {
      const noName = { ...apiExperiment };
      delete (noName as any).feature_flag_name;
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [noName] }),
        config,
      } as any);
      try {
        await handler.getType();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('feature_flag_name');
      }
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

    it('omits frozen fields when the experiment is active, so re-import is idempotent', async () => {
      const capture: any = {};
      const activeExperiment = {
        ...apiExperiment,
        status: 'active',
        editable_fields: ['name', 'description'],
      };
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [activeExperiment], capture }),
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
              allocation_strategy: 'percentage',
              allocations: [
                { variation_name: 'control', is_control: true, weight: 50 },
                { variation_name: 'variant-a', is_control: false, weight: 50 },
              ],
            },
          ],
        },
      ]);

      // activated experiment is snapshot-frozen: the update sends only the status value (no field
      // edits, which would 409), and the unchanged status is an accepted idempotent no-op.
      expect(capture.update.body).to.not.have.property('allocations');
      expect(capture.update.body).to.not.have.property('authentication_flow');
      expect(capture.update.body).to.not.have.property('name');
      expect(capture.update.body).to.deep.equal({ status: 'active' });
    });

    it('sends only a status transition for a non-draft experiment (active to paused)', async () => {
      const capture: any = {};
      const activeExperiment = {
        ...apiExperiment,
        status: 'active',
        editable_fields: ['name', 'description'],
      };
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [activeExperiment], capture }),
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
              status: 'paused',
              allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
            },
          ],
        },
      ]);

      expect(capture.update.body).to.deep.equal({ status: 'paused' });
    });

    it('warns when a frozen (non-draft) experiment has config changes that are dropped', async () => {
      const logWarn = sinon.stub(log, 'warn');
      const capture: any = {};
      const activeExperiment = {
        ...apiExperiment,
        status: 'active',
        editable_fields: ['name', 'description'],
      };
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [activeExperiment], capture }),
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
              allocation_strategy: 'percentage',
              // weights changed from 50/50; frozen, so this edit is dropped
              allocations: [
                { variation_name: 'control', is_control: true, weight: 80 },
                { variation_name: 'variant-a', is_control: false, weight: 20 },
              ],
            },
          ],
        },
      ]);

      expect(capture.update.body).to.deep.equal({ status: 'active' });
      expect(logWarn.calledOnce).to.equal(true);
      expect(logWarn.firstCall.args[0]).to.include('frozen');
    });

    it('warns when allocation_strategy is changed on an existing draft (create-only)', async () => {
      const logWarn = sinon.stub(log, 'warn');
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
              // apiExperiment is 'percentage'; switching to 'segment' cannot be applied
              allocation_strategy: 'segment',
              allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
            },
          ],
        },
      ]);

      expect(logWarn.calledOnce).to.equal(true);
      expect(logWarn.firstCall.args[0]).to.include('allocation_strategy');
      // the mismatched allocations are not sent, so "the change is ignored" actually holds
      expect(capture.update.body).to.not.have.property('allocations');
    });

    it('skips (warns, does not abort, no created count) when create returns feature_not_entitled', async () => {
      const logWarn = sinon.stub(log, 'warn');
      const client = pageClient({
        experimentation: {
          experiments: {
            list: () => Promise.resolve(makePage([])),
            create: () => Promise.reject(notEntitledError()),
          },
          featureFlags: {
            list: () => Promise.resolve(makePage([flag])),
            variations: { list: () => Promise.resolve({ variations }) },
          },
          segments: { list: () => Promise.resolve(makePage([segment])) },
        },
        pool,
      } as any);
      const handler = new ExperimentsHandler({ client, config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      // An experiment using advanced ramp ("levels") on a non-entitled tenant: the create 403s,
      // but the run must not abort, the one experiment is skipped with a warning.
      await stageFn.apply(handler, [
        {
          experiments: [
            {
              name: 'ramp-exp',
              feature_flag_name: 'checkout',
              authentication_flow: 'authentication',
              allocation_strategy: 'percentage',
              levels: [10, 50, 100],
              allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
            },
          ],
        },
      ]);

      expect(logWarn.called).to.equal(true);
      expect(logWarn.firstCall.args[0]).to.include('not entitled');
      // the skipped create must not count toward the run summary
      expect(handler.created).to.equal(0);
    });

    it('skips (warns, no updated count) when update returns feature_not_entitled', async () => {
      const logWarn = sinon.stub(log, 'warn');
      const client = pageClient({
        experimentation: {
          experiments: {
            list: () => Promise.resolve(makePage([apiExperiment])),
            update: () => Promise.reject(notEntitledError()),
          },
          featureFlags: {
            list: () => Promise.resolve(makePage([flag])),
            variations: { list: () => Promise.resolve({ variations }) },
          },
          segments: { list: () => Promise.resolve(makePage([segment])) },
        },
        pool,
      } as any);
      const handler = new ExperimentsHandler({ client, config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      // Re-import the existing draft experiment with a changed level, which the tenant is not
      // entitled to: the update 403s, the experiment is skipped with a warning, and the deploy
      // summary must not report an update that never happened.
      await stageFn.apply(handler, [
        {
          experiments: [
            {
              id: 'exp_1',
              name: 'checkout-test',
              feature_flag_name: 'checkout',
              authentication_flow: 'authentication',
              allocation_strategy: 'percentage',
              levels: [10, 50, 100],
              allocations: [
                { variation_name: 'control', is_control: true, weight: 50 },
                { variation_name: 'variant-a', is_control: false, weight: 50 },
              ],
            },
          ],
        },
      ]);

      expect(logWarn.called).to.equal(true);
      expect(handler.updated).to.equal(0);
    });

    it('rethrows a create error that is not feature_not_entitled', async () => {
      const client = pageClient({
        experimentation: {
          experiments: {
            list: () => Promise.resolve(makePage([])),
            create: () => Promise.reject(Object.assign(new Error('boom'), { statusCode: 500 })),
          },
          featureFlags: {
            list: () => Promise.resolve(makePage([flag])),
            variations: { list: () => Promise.resolve({ variations }) },
          },
          segments: { list: () => Promise.resolve(makePage([segment])) },
        },
        pool,
      } as any);
      const handler = new ExperimentsHandler({ client, config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [
          {
            experiments: [
              {
                name: 'exp',
                feature_flag_name: 'checkout',
                authentication_flow: 'authentication',
                allocation_strategy: 'percentage',
                allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
              },
            ],
          },
        ]);
        expect.fail('Should have rethrown the non-entitlement error');
      } catch (err: any) {
        expect(err.message).to.include('boom');
      }
    });

    it('allows all draft field edits when the response carries no editable_fields', async () => {
      const capture: any = {};
      const draftNoEditable = { ...apiExperiment };
      delete (draftNoEditable as any).editable_fields;
      const handler = new ExperimentsHandler({
        client: makeClient({ experiments: [draftNoEditable], capture }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          experiments: [
            {
              id: 'exp_1',
              name: 'renamed',
              feature_flag_name: 'checkout',
              authentication_flow: 'authentication',
              allocation_strategy: 'percentage',
              allocations: [{ variation_name: 'control', is_control: true, weight: 100 }],
            },
          ],
        },
      ]);

      // null editable_fields means "no restriction", so edits are sent rather than an empty body
      expect(capture.update.body.name).to.equal('renamed');
      expect(capture.update.body.allocations[0].variation_id).to.equal('var_c');
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
