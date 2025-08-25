import { expect } from 'chai';
import { PromisePoolExecutor } from 'promise-pool-executor';
import {
  calculateChanges,
  processChangedObjectFields,
  calculateDryRunChanges,
} from '../../src/tools/calculateChanges';
import DefaultHandler from '../../src/tools/auth0/handlers/default';
import { configFactory } from '../../src/configFactory';
import { Auth0APIClient } from '../../src/types';

// Create a mock Auth0 API client
const mockApiClient: Auth0APIClient = {
  // @ts-ignore
  mock: {
    delete: async (id: string) => ({ id }),
    create: async (data: any) => ({ ...data, id: 'created-id' }),
    update: async (id: string, data: any) => ({ ...data, id }),
    getAll: async () => ({ data: [] }),
  },
  pool: new PromisePoolExecutor({
    concurrencyLimit: 100,
    frequencyLimit: 3,
    frequencyWindow: 1000, // 1 sec
  }),
};

class MockHandler extends DefaultHandler {
  constructor(settings = {}) {
    const config = configFactory();
    // eslint-disable-next-line no-restricted-syntax
    for (const key of Object.keys(settings)) {
      // @ts-ignore
      config.setValue(key, settings[key]);
    }

    super({
      // @ts-ignore
      config,
      type: 'mock',
      client: mockApiClient,
      functions: {
        getAll: 'getAll',
        create: 'create',
        update: 'update',
        delete: 'delete',
      },
    });
  }
}

describe('#utils calcChanges', () => {
  const mockHandler = new MockHandler();

  const mockHandlerWithObjectFields = (() => {
    const handler = new MockHandler();
    handler.objectFields = ['metadata'];
    return handler;
  })();

  it('should calc create', () => {
    const existing = [{ name: 'Name1', id: 'id1' }];
    const assets = [
      { name: 'Name1', id: 'id3' },
      { name: 'Create1', id: 'Create1' },
    ];

    const { create } = calculateChanges({
      handler: mockHandler,
      assets,
      existing,
      identifiers: ['id', 'name'],
      allowDelete: false,
    });

    expect(create).to.have.length(1);
    expect(create).to.deep.include({ name: 'Create1', id: 'Create1' });
  });

  it('should calc create grouped identifiers', () => {
    const existing = [{ client_id: 'client1', audience: 'audience1', id: 'id1' }];
    const assets = [
      { client_id: 'client1', audience: 'audience1', id: 'id3' },
      { client_id: 'create1', audience: 'create1', id: 'create1' },
    ];

    const { create } = calculateChanges({
      handler: mockHandler,
      assets,
      existing,
      allowDelete: false,
      // @ts-ignore need to investigate why this "grouping" exists
      identifiers: ['id', ['client_id', 'audience']],
    });

    expect(create).to.have.length(1);
    expect(create).to.deep.include({ client_id: 'create1', audience: 'create1', id: 'create1' });
  });

  it('should calc delete', () => {
    const existing = [
      { name: 'Name1', id: 'id3' },
      { name: 'Delete1', id: 'Delete1' },
    ];
    const assets = [{ name: 'Name1', id: 'id1' }];

    const { del } = calculateChanges({
      handler: mockHandler,
      assets,
      existing,
      identifiers: ['id', 'name'],
      allowDelete: false,
    });

    expect(del).to.have.length(1);
    expect(del).to.deep.include({ name: 'Delete1', id: 'Delete1' });
  });

  it('should calc update', () => {
    const existing = [
      { name: 'Name1', id: 'id3' },
      { name: 'Update1', id: 'Update1' },
    ];
    const assets = [{ name: 'Name1', id: 'id1' }];

    const { update } = calculateChanges({
      handler: mockHandler,
      assets,
      existing,
      identifiers: ['id', 'name'],
      allowDelete: false,
    });

    expect(update).to.have.length(1);
    expect(update).to.deep.include({ name: 'Name1', id: 'id1' });
  });

  it('should skip deletion of dropped keys in objectFields when ALLOW_DELETE is not enabled', () => {
    const existing = [
      {
        id: 'id3',
        metadata: {
          should_be_preserved: 'should_be_preserved',
          should_be_changed: 'should_be_changed',
          should_be_removed: 'should_be_removed',
        },
      },
    ];
    const assets = [
      {
        id: 'id3',
        metadata: {
          should_be_preserved: 'should_be_preserved',
          should_be_changed: 'was_changed',
          should_be_added: 'was_added',
        },
      },
    ];

    const { update: updateWithoutAllowDelete } = calculateChanges({
      handler: mockHandlerWithObjectFields,
      assets,
      existing,
      identifiers: ['id'],
      allowDelete: false,
    });

    expect(updateWithoutAllowDelete).to.have.length(1);
    expect(updateWithoutAllowDelete).to.deep.include({
      id: 'id3',
      metadata: {
        should_be_preserved: 'should_be_preserved',
        should_be_changed: 'was_changed',
        should_be_added: 'was_added',
      },
    });

    const { update: updateWithAllowDelete } = calculateChanges({
      handler: mockHandlerWithObjectFields,
      assets,
      existing,
      identifiers: ['id'],
      allowDelete: true,
    });

    expect(updateWithAllowDelete).to.have.length(1);
    expect(updateWithAllowDelete).to.deep.include({
      id: 'id3',
      metadata: {
        should_be_preserved: 'should_be_preserved',
        should_be_changed: 'was_changed',
        should_be_removed: null,
        should_be_added: 'was_added',
      },
    });
  });

  it('should skip emptying objectFields when ALLOW_DELETE is not enabled', () => {
    const existing = [
      {
        id: 'id1',
        metadata: {
          should_be_removed: 'should_be_removed',
        },
      },
      {
        id: 'id2',
        metadata: {
          should_be_removed: 'should_be_removed',
        },
      },
    ];
    const assets = [
      {
        id: 'id1',
        // An empty objectField should signal deletion
        metadata: {},
      },
      {
        id: 'id2',
        // A missing objectField should also signal deletion
      },
    ];

    const { update: updateWithoutAllowDelete } = calculateChanges({
      handler: mockHandlerWithObjectFields,
      assets,
      existing,
      identifiers: ['id'],
      allowDelete: false,
    });

    expect(updateWithoutAllowDelete).to.have.length(2);
    expect(updateWithoutAllowDelete).to.deep.include({
      id: 'id1',
    });
    expect(updateWithoutAllowDelete).to.deep.include({
      id: 'id2',
    });

    const { update: updateWithAllowDelete } = calculateChanges({
      handler: mockHandlerWithObjectFields,
      assets,
      existing,
      identifiers: ['id'],
      allowDelete: true,
    });

    expect(updateWithAllowDelete).to.have.length(2);
    expect(updateWithAllowDelete).to.deep.include({
      id: 'id1',
      metadata: {},
    });
    expect(updateWithAllowDelete).to.deep.include({
      id: 'id2',
      metadata: {},
    });
  });

  it('should calc update grouped identifiers', () => {
    const existing = [
      { client_id: 'client1', audience: 'audience1', id: 'id1' },
      { client_id: 'Update1', audience: 'Update1', id: 'Update1' },
    ];
    const assets = [{ client_id: 'client1', audience: 'audience1', id: 'id3' }];

    const { update } = calculateChanges({
      handler: mockHandler,
      assets,
      existing,
      allowDelete: false,
      // @ts-ignore need to look into why these "groupings exist"
      identifiers: ['id', ['client_id', 'audience']],
    });

    expect(update).to.have.length(1);
    expect(update).to.deep.include({ client_id: 'client1', audience: 'audience1', id: 'id3' });
  });
});

describe('#utils processChangedObjectFields', () => {
  const handler = new MockHandler();
  handler.objectFields = ['client_metadata'];

  it('should propose no changes if object field of current and desired states are both empty', () => {
    const desiredObjectFieldState = processChangedObjectFields({
      handler,
      currentAssetState: {},
      desiredAssetState: {},
      allowDelete: false,
    });
    expect(desiredObjectFieldState).to.deep.equal({});

    const desiredObjectFieldStateWithDelete = processChangedObjectFields({
      handler,
      currentAssetState: {},
      desiredAssetState: {},
      allowDelete: true,
    });
    expect(desiredObjectFieldStateWithDelete).to.deep.equal({});
  });

  it('should propose no change if object field exists in both current and desired states', () => {
    const currentAssetState = {
      client_metadata: {
        foo: 'bar',
      },
    };

    const desiredAssetState = {
      client_metadata: {
        foo: 'bar',
      },
    };

    const desiredObjectFieldState = processChangedObjectFields({
      handler,
      currentAssetState,
      desiredAssetState,
      allowDelete: false,
    });
    expect(desiredObjectFieldState).to.deep.equal(desiredAssetState);
  });

  it('should propose no change if object field exists in current state but not in the desired state and not allowing deletes', () => {
    const currentAssetState = {
      client_metadata: {
        foo: 'bar',
      },
    };

    const desiredAssetState = {
      client_metadata: {},
    };

    const desiredObjectFieldState = processChangedObjectFields({
      handler,
      currentAssetState,
      desiredAssetState,
      allowDelete: false,
    });
    expect(desiredObjectFieldState).to.deep.equal({});
  });

  it('should propose to delete the object field if exists in current state but not in the desired state and are allowing deletes', () => {
    const currentAssetState = {
      client_metadata: {
        foo: 'bar',
      },
    };

    const desiredAssetState = {
      client_metadata: {},
    };

    const desiredObjectFieldState = processChangedObjectFields({
      handler,
      currentAssetState,
      desiredAssetState,
      allowDelete: true,
    });
    expect(desiredObjectFieldState).to.deep.equal({ client_metadata: {} });
  });

  it('should propose no change if object field exists in desired state but not in the current state and not allowing deletes', () => {
    const currentAssetState = {
      client_metadata: {},
    };

    const desiredAssetState = {
      client_metadata: {
        foo: 'bar',
      },
    };

    const desiredObjectFieldState = processChangedObjectFields({
      handler,
      currentAssetState,
      desiredAssetState,
      allowDelete: false,
    });
    expect(desiredObjectFieldState).to.deep.equal(desiredAssetState);
  });
});

describe('#calculateDryRunChanges', () => {
  it('should identify resources to create when no existing resources', () => {
    const assets = [
      { id: 'new1', name: 'New Resource 1' },
      { id: 'new2', name: 'New Resource 2' },
    ];
    const existing = [];

    const changes = calculateDryRunChanges({
      type: 'test',
      assets,
      existing,
      identifiers: ['id', 'name'],
    });

    expect(changes.create).to.have.length(2);
    expect(changes.create).to.deep.include({ id: 'new1', name: 'New Resource 1' });
    expect(changes.create).to.deep.include({ id: 'new2', name: 'New Resource 2' });
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(0);
    expect(changes.conflicts).to.have.length(0);
  });

  it('should identify resources to update when existing resources match', () => {
    const assets = [
      { id: 'existing1', name: 'Updated Resource 1', description: 'new description' },
    ];
    const existing = [
      { id: 'existing1', name: 'Updated Resource 1', description: 'old description' },
    ];

    const changes = calculateDryRunChanges({
      type: 'test',
      assets,
      existing,
      identifiers: ['id', 'name'],
    });

    expect(changes.create).to.have.length(0);
    expect(changes.update).to.have.length(1);
    expect(changes.update[0]).to.deep.include({
      id: 'existing1',
      name: 'Updated Resource 1',
      description: 'new description',
    });
    expect(changes.del).to.have.length(0);
    expect(changes.conflicts).to.have.length(0);
  });

  it('should identify resources to delete when not in assets', () => {
    const assets = [];
    const existing = [
      { id: 'remove1', name: 'Resource To Remove' },
      { id: 'remove2', name: 'Another Resource To Remove' },
    ];

    const changes = calculateDryRunChanges({
      type: 'test',
      assets,
      existing,
      identifiers: ['id', 'name'],
    });

    expect(changes.create).to.have.length(0);
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(2);
    expect(changes.del).to.deep.include({ id: 'remove1', name: 'Resource To Remove' });
    expect(changes.del).to.deep.include({ id: 'remove2', name: 'Another Resource To Remove' });
    expect(changes.conflicts).to.have.length(0);
  });

  it('should handle mixed scenarios with create, update, and delete', () => {
    const assets = [{ id: 'existing1', name: 'Updated Resource', description: 'updated' }];
    const existing = [
      { id: 'existing1', name: 'Updated Resource', description: 'original' },
      { id: 'remove1', name: 'Resource To Remove' },
    ];

    const changes = calculateDryRunChanges({
      type: 'test',
      assets,
      existing,
      identifiers: ['id', 'name'],
    });

    // Should have at least one update and one delete
    expect(changes.update.length).to.be.greaterThan(0);
    expect(changes.del.length).to.be.greaterThan(0);
    expect(changes.conflicts).to.have.length(0);
  });

  it('should handle no changes when assets match existing', () => {
    const assets = [{ id: 'same1', name: 'Unchanged Resource', description: 'same' }];
    const existing = [{ id: 'same1', name: 'Unchanged Resource', description: 'same' }];

    const changes = calculateDryRunChanges({
      type: 'test',
      assets,
      existing,
      identifiers: ['id', 'name'],
    });

    expect(changes.create).to.have.length(0);
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(0);
    expect(changes.conflicts).to.have.length(0);
  });

  it('should handle single asset and existing resource', () => {
    const assets = { id: 'single', name: 'Single Resource', updated: true };
    const existing = { id: 'single', name: 'Single Resource', updated: false };

    const changes = calculateDryRunChanges({
      type: 'test',
      assets,
      existing,
      identifiers: ['id', 'name'],
    });

    expect(changes.create).to.have.length(0);
    expect(changes.update).to.have.length(1);
    expect(changes.update[0]).to.deep.include({
      id: 'single',
      name: 'Single Resource',
      updated: true,
    });
    expect(changes.del).to.have.length(0);
    expect(changes.conflicts).to.have.length(0);
  });

  it('should handle null existing resources', () => {
    const assets = [{ id: 'new1', name: 'New Resource' }];
    const existing = [];

    const changes = calculateDryRunChanges({
      type: 'test',
      assets,
      existing,
      identifiers: ['id', 'name'],
    });

    expect(changes.create).to.have.length(1);
    expect(changes.create[0]).to.deep.include({ id: 'new1', name: 'New Resource' });
    expect(changes.update).to.have.length(0);
    expect(changes.del).to.have.length(0);
    expect(changes.conflicts).to.have.length(0);
  });
});
