import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';
import sinon from 'sinon';

import SegmentsHandler from '../../../../src/tools/auth0/handlers/segments';
import pageClient from '../../../../src/tools/auth0/client';
import log from '../../../../src/logger';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000,
});

const sampleSegment = {
  id: 'seg_gold_123',
  name: 'gold-plan-visitors',
  description: 'Visitors on the gold plan',
  type: 'self',
  status: 'active',
  rules: [{ match: { country: ['US'] } }],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const managedSegment = {
  id: 'seg_a0_managed',
  name: 'Auth0 managed segment',
  type: 'auth0',
  status: 'active',
  rules: [],
};

// How sampleSegment looks after export: read-only / API-generated fields are stripped.
const exportedSampleSegment = {
  id: 'seg_gold_123',
  name: 'gold-plan-visitors',
  description: 'Visitors on the gold plan',
  status: 'active',
  rules: [{ match: { country: ['US'] } }],
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

function makeClient(segments: any) {
  return pageClient({ experimentation: { segments }, pool } as any);
}

describe('#segments handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };
  config.data = { AUTH0_ALLOW_DELETE: false };

  afterEach(() => {
    sinon.restore();
    // Reset here rather than inline so a failing assertion cannot leak the flag into later tests.
    config.data.AUTH0_ALLOW_DELETE = false;
  });

  describe('#segments validate', () => {
    it('should reject segments with duplicate names', async () => {
      const handler = new SegmentsHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;
      try {
        await stageFn.apply(handler, [
          {
            segments: [
              { name: 'dup', rules: [] },
              { name: 'dup', rules: [] },
            ],
          },
        ]);
        expect.fail('Should have thrown on duplicate names');
      } catch (err: any) {
        expect(err.message).to.include('Names must be unique');
      }
    });
  });

  describe('#segments getType', () => {
    it('should list customer-defined segments', async () => {
      const handler = new SegmentsHandler({
        client: makeClient({ list: () => Promise.resolve(makePage([sampleSegment])) }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([exportedSampleSegment]);
    });

    it('should exclude Auth0-managed (type: auth0) segments', async () => {
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([sampleSegment, managedSegment])),
        }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([exportedSampleSegment]);
    });

    it('should strip read-only fields (type, created_at, updated_at) on export', async () => {
      const handler = new SegmentsHandler({
        client: makeClient({ list: () => Promise.resolve(makePage([sampleSegment])) }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data![0]).to.not.have.property('type');
      expect(data![0]).to.not.have.property('created_at');
      expect(data![0]).to.not.have.property('updated_at');
      expect(data![0].name).to.equal(sampleSegment.name);
      expect(data![0].rules).to.deep.equal(sampleSegment.rules);
    });

    it('returns null on 403 (tenant without the Experiment Center entitlement)', async () => {
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () => Promise.reject(Object.assign(new Error('forbidden'), { statusCode: 403 })),
        }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('returns null on 404', async () => {
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () => Promise.reject(Object.assign(new Error('not found'), { statusCode: 404 })),
        }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.equal(null);
    });

    it('rethrows a missing-scope 403 so the base scope warning still fires', async () => {
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () =>
            Promise.reject(
              Object.assign(
                new Error('Insufficient scope, expected any of: read:experimentation'),
                { statusCode: 403 }
              )
            ),
        }),
        config,
      } as any);
      try {
        await handler.getType();
        expect.fail('Should have rethrown the insufficient-scope error');
      } catch (err: any) {
        expect(err.message).to.include('Insufficient scope');
      }
    });
  });

  describe('#segments processChanges', () => {
    it('should create a segment and strip read-only / non-create fields', async () => {
      let created: any = null;
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([])),
          create: (data) => {
            created = data;
            return Promise.resolve({ ...data, id: 'seg_new' });
          },
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ segments: [sampleSegment] }]);

      expect(created.name).to.equal(sampleSegment.name);
      expect(created.rules).to.deep.equal(sampleSegment.rules);
      expect(created).to.not.have.property('id');
      expect(created).to.not.have.property('type');
      expect(created).to.not.have.property('status');
      expect(created).to.not.have.property('created_at');
    });

    it('should update an existing segment and allow archiving on update', async () => {
      let updatedId: string | null = null;
      let updatedData: any = null;
      const existing = { ...sampleSegment, status: 'active' };
      const desired = { ...sampleSegment, status: 'archived' };

      const handler = new SegmentsHandler({
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

      await stageFn.apply(handler, [{ segments: [desired] }]);

      expect(updatedId).to.equal(sampleSegment.id);
      expect(updatedData.status).to.equal('archived');
      expect(updatedData).to.not.have.property('type');
    });

    it('should send only status for an archived segment so re-import is idempotent', async () => {
      const logWarn = sinon.stub(log, 'warn');
      let updatedData: any = null;
      const archived = { ...sampleSegment, status: 'archived' };
      const handler = new SegmentsHandler({
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

      await stageFn.apply(handler, [{ segments: [archived] }]);

      // archived segments are immutable; only the status is sent (no rules/name), avoiding
      // segment_archived on every re-import
      expect(updatedData).to.deep.equal({ status: 'archived' });
      // nothing changed, so no warning is emitted
      expect(logWarn.called).to.equal(false);
    });

    it('should warn and send only status when an archived segment has ignored rule changes', async () => {
      const logWarn = sinon.stub(log, 'warn');
      let updatedData: any = null;
      const archived = { ...sampleSegment, status: 'archived' };
      // Desired config changes the rules on the archived segment; the edit cannot be applied.
      const desired = { ...archived, rules: [{ match: { country: ['CA'] } }] };
      const handler = new SegmentsHandler({
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

      await stageFn.apply(handler, [{ segments: [desired] }]);

      expect(updatedData).to.deep.equal({ status: 'archived' });
      expect(logWarn.calledOnce).to.equal(true);
      expect(logWarn.firstCall.args[0]).to.include(sampleSegment.name);
    });

    it('should warn when un-archiving an archived segment is attempted', async () => {
      const logWarn = sinon.stub(log, 'warn');
      let updatedData: any = null;
      const archived = { ...sampleSegment, status: 'archived' };
      const desired = { ...archived, status: 'active' };
      const handler = new SegmentsHandler({
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

      await stageFn.apply(handler, [{ segments: [desired] }]);

      expect(updatedData).to.deep.equal({ status: 'archived' });
      expect(logWarn.calledOnce).to.equal(true);
    });

    it('should delete a segment when AUTH0_ALLOW_DELETE is true', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      let deletedId: string | null = null;
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([sampleSegment])),
          delete: (id) => {
            deletedId = id;
            return Promise.resolve();
          },
          create: () => Promise.resolve({}),
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ segments: [] }]);
      expect(deletedId).to.equal(sampleSegment.id);
      // AUTH0_ALLOW_DELETE is reset in afterEach so a failure here cannot leak into later tests.
    });

    it('should not delete a segment when AUTH0_ALLOW_DELETE is false', async () => {
      let deleteCalled = false;
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([sampleSegment])),
          delete: () => {
            deleteCalled = true;
            return Promise.resolve();
          },
        }),
        config,
      } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ segments: [] }]);
      expect(deleteCalled).to.equal(false);
    });
  });
});
