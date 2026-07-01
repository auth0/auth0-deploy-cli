import { PromisePoolExecutor } from 'promise-pool-executor';
import { expect } from 'chai';

import EventStreamsHandler from '../../../../src/tools/auth0/handlers/eventStreams';
import pageClient from '../../../../src/tools/auth0/client';

const pool = new PromisePoolExecutor({
  concurrencyLimit: 3,
  frequencyLimit: 1000,
  frequencyWindow: 1000,
});

const sampleWebhookStream = {
  id: 'es_webhook_123',
  name: 'My Webhook Stream',
  status: 'enabled',
  subscriptions: [{ event_type: 'user.created' }, { event_type: 'user.deleted' }],
  destination: {
    type: 'webhook',
    configuration: {
      webhook_endpoint: 'https://example.com/webhook',
      webhook_authorization: {
        method: 'bearer',
      },
    },
  },
};

// action_id as returned by the API (raw ID)
const sampleActionStreamApi = {
  id: 'es_action_789',
  name: 'My Action Stream',
  status: 'enabled',
  subscriptions: [{ event_type: 'user.created' }],
  destination: {
    type: 'action',
    configuration: {
      action_id: 'act_abc123',
    },
  },
};

// action_id as stored in config files (resolved name)
const sampleActionStreamConfig = {
  id: 'es_action_789',
  name: 'My Action Stream',
  status: 'enabled',
  subscriptions: [{ event_type: 'user.created' }],
  destination: {
    type: 'action',
    configuration: {
      action_id: 'My Event Stream Action',
    },
  },
};

const sampleEventBridgeStream = {
  id: 'es_eb_456',
  name: 'My EventBridge Stream',
  status: 'enabled',
  subscriptions: [{ event_type: 'organization.created' }],
  destination: {
    type: 'eventbridge',
    configuration: {
      aws_account_id: '123456789012',
      aws_region: 'us-east-1',
    },
  },
};

const sampleAction = {
  id: 'act_abc123',
  name: 'My Event Stream Action',
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

function makeActionsList(actions: any[]) {
  return () => Promise.resolve({ data: actions });
}

describe('#eventStreams handler', () => {
  const config = function (key) {
    return config.data && config.data[key];
  };

  config.data = {
    AUTH0_ALLOW_DELETE: false,
  };

  describe('#eventStreams validate', () => {
    it('should pass validation when eventStreams is not set', async () => {
      const handler = new EventStreamsHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;
      await stageFn.apply(handler, [{}]);
    });

    it('should pass validation for a valid webhook event stream', async () => {
      const handler = new EventStreamsHandler({ client: {}, config } as any);
      const stageFn = Object.getPrototypeOf(handler).validate;
      await stageFn.apply(handler, [{ eventStreams: [sampleWebhookStream] }]);
    });
  });

  describe('#eventStreams getType', () => {
    it('should return all event streams from a single page', async () => {
      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([sampleWebhookStream])),
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleWebhookStream]);
    });

    it('should accumulate event streams across multiple pages', async () => {
      const secondPage = makePage([sampleEventBridgeStream]);
      const firstPage = {
        data: [sampleWebhookStream],
        hasNextPage: () => true,
        getNextPage: () => Promise.resolve(secondPage),
      };

      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(firstPage),
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([sampleWebhookStream, sampleEventBridgeStream]);
    });

    it('should return empty array when no event streams exist', async () => {
      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([])),
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const data = await handler.getType();
      expect(data).to.deep.equal([]);
    });

    it('should replace action_id with action name on export', async () => {
      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([sampleActionStreamApi])),
        },
        actions: { list: makeActionsList([sampleAction]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const data = (await handler.getType()) as any[];
      expect(data[0].destination.configuration.action_id).to.equal('My Event Stream Action');
    });
  });

  describe('#eventStreams processChanges', () => {
    it('should return early if eventStreams is not set', async () => {
      let createCalled = false;
      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([])),
          create: () => {
            createCalled = true;
            return Promise.resolve({});
          },
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;
      await stageFn.apply(handler, [{}]);
      expect(createCalled).to.equal(false);
    });

    it('should create a new event stream', async () => {
      let created: any = null;
      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([])),
          create: (data) => {
            created = data;
            return Promise.resolve({ ...data, id: 'new_es_id' });
          },
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ eventStreams: [sampleWebhookStream] }]);
      expect(created).to.not.equal(null);
      expect(created.name).to.equal(sampleWebhookStream.name);
    });

    it('should update an existing event stream', async () => {
      let updatedId: string | null = null;
      let updatedData: any = null;
      const existing = { ...sampleWebhookStream, status: 'disabled' };

      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([existing])),
          update: (id, data) => {
            updatedId = id;
            updatedData = data;
            return Promise.resolve(data);
          },
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ eventStreams: [sampleWebhookStream] }]);
      expect(updatedId).to.equal(sampleWebhookStream.id);
      expect(updatedData.status).to.equal('enabled');
    });

    it('should strip destination from update payload for eventbridge streams', async () => {
      let updatedData: any = null;
      const existing = { ...sampleEventBridgeStream };

      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([existing])),
          update: (id, data) => {
            updatedData = data;
            return Promise.resolve(data);
          },
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [
        {
          eventStreams: [
            { ...sampleEventBridgeStream, subscriptions: [{ event_type: 'user.created' }] },
          ],
        },
      ]);
      // destination should have been removed for eventbridge
      expect(updatedData).to.not.have.property('destination');
    });

    it('should delete event stream when AUTH0_ALLOW_DELETE is true', async () => {
      config.data.AUTH0_ALLOW_DELETE = true;
      let deletedId: string | null = null;

      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([sampleWebhookStream])),
          delete: (id) => {
            deletedId = id;
            return Promise.resolve();
          },
          create: () => Promise.resolve({}),
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ eventStreams: [] }]);
      expect(deletedId).to.equal(sampleWebhookStream.id);

      config.data.AUTH0_ALLOW_DELETE = false;
    });

    it('should resolve action name to ID when creating action-destination stream', async () => {
      let created: any = null;
      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([])),
          create: (data) => {
            created = data;
            return Promise.resolve({ ...data, id: 'new_action_es_id' });
          },
        },
        actions: { list: makeActionsList([sampleAction]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ eventStreams: [sampleActionStreamConfig] }]);
      expect(created).to.not.equal(null);
      expect(created.destination.type).to.equal('action');
      // name should have been resolved back to raw ID for the API
      expect(created.destination.configuration.action_id).to.equal('act_abc123');
    });

    it('should resolve action name to ID when updating action-destination stream', async () => {
      let updatedData: any = null;
      const existing = { ...sampleActionStreamConfig, status: 'disabled' };

      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([existing])),
          update: (id, data) => {
            updatedData = data;
            return Promise.resolve(data);
          },
        },
        actions: { list: makeActionsList([sampleAction]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ eventStreams: [sampleActionStreamConfig] }]);
      expect(updatedData.destination.configuration.action_id).to.equal('act_abc123');
    });

    it('should throw when action-destination references unknown action name', async () => {
      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([])),
          create: () => Promise.resolve({}),
        },
        actions: { list: makeActionsList([]) }, // no actions available
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      try {
        await stageFn.apply(handler, [{ eventStreams: [sampleActionStreamConfig] }]);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('My Event Stream Action');
        expect(err.message).to.include('not found');
      }
    });

    it('should not delete event stream when AUTH0_ALLOW_DELETE is false', async () => {
      let deleteCalled = false;

      const auth0 = {
        eventStreams: {
          list: () => Promise.resolve(makePage([sampleWebhookStream])),
          delete: () => {
            deleteCalled = true;
            return Promise.resolve();
          },
        },
        actions: { list: makeActionsList([]) },
        pool,
      };

      const handler = new EventStreamsHandler({ client: pageClient(auth0 as any), config } as any);
      const stageFn = Object.getPrototypeOf(handler).processChanges;

      await stageFn.apply(handler, [{ eventStreams: [] }]);
      expect(deleteCalled).to.equal(false);
    });
  });
});
