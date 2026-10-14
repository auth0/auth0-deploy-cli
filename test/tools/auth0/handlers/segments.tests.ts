import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';

import SegmentsHandler from '../../../../src/tools/auth0/handlers/segments';
import pageClient from '../../../../src/tools/auth0/client';

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
      expect(data).to.deep.equal([sampleSegment]);
    });

    it('should exclude Auth0-managed (type: auth0) segments', async () => {
      const handler = new SegmentsHandler({
        client: makeClient({
          list: () => Promise.resolve(makePage([sampleSegment, managedSegment])),
        }),
        config,
      } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleSegment]);
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
      config.data.AUTH0_ALLOW_DELETE = false;
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
