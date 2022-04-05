import { expect } from 'chai';
import { calculateChanges, processChangedObjectFields } from '../../src/tools/calculateChanges';
import DefaultHandler from '../../src/tools/auth0/handlers/default';
import { configFactory } from '../../src/configFactory';

describe('#utils calcChanges', () => {
  class MockHandler extends DefaultHandler {
    constructor(settings = {}) {
      const config = configFactory();
      // eslint-disable-next-line no-restricted-syntax
      for (const key of Object.keys(settings)) {
        //@ts-ignore
        config.setValue(key, settings[key]);
      }

      super({
        //@ts-ignore
        config,
        type: 'mock',
      });
    }
  }

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
      //@ts-ignore need to investigate why this "grouping" exists
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
      //@ts-ignore need to look into why these "groupings exist"
      identifiers: ['id', ['client_id', 'audience']],
    });

    expect(update).to.have.length(1);
    expect(update).to.deep.include({ client_id: 'client1', audience: 'audience1', id: 'id3' });
  });
});

describe('#utils processChangedObjectFields', () => {
  const handler = {
    id: 'test-handler',
    objectFields: ['client_metadata'],
    objString: () => {
      return '';
    },
  };

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
