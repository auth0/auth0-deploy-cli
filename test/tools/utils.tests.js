import path from 'path';
import { expect } from 'chai';
import * as utils from '../../src/tools/utils';
import DefaultHandler from '../../src/tools/auth0/handlers/default';
import configFactory from '../../src/configFactory';

const mappings = {
  string: 'some string',
  array: [
    'some value',
    'some other value'
  ],
  object: {
    key1: 'value1',
    key2: 'value2'
  },
  int: 5
};

const expectations = {
  a: 1,
  array_key: [
    'some value',
    'some other value'
  ],
  int_key: 5,
  object_key: {
    key1: 'value1',
    key2: 'value2'
  },
  simple_array_key: 'Some\'some value,some other value',
  simple_int_key: 5,
  simple_object_key: 'Some [object Object]',
  simple_string_key: 'Some some string',
  string_key: 'some string'
};

describe('#utils', function() {
  it('should load file', () => {
    const file = path.resolve(__dirname, 'test.file.json');
    const loaded = utils.loadFile(file, mappings);
    expect(JSON.parse(loaded)).to.deep.equal(expectations);
  });

  it('should throw error if cannot load file', () => {
    expect(function() {
      utils.loadFile('notexist.json', mappings);
    }).to.throw(/Unable to load file.*/);
  });

  it('should do keyword replacements', (done) => {
    const kwContents = '{ "a": 1, "string_key": @@string@@, "array_key": @@array@@, "object_key": @@object@@,'
      + ' "int_key": @@int@@, "simple_string_key": "Some ##string##", "simple_array_key": "Some'
      + ' ##array##", "simple_object_key": "Some ##object##", "simple_int_key": ##int## }';

    const kwExpectations = '{ "a": 1, "string_key": "some string", "array_key": ["some value","some other value"],'
      + ' "object_key": {"key1":"value1","key2":"value2"}, "int_key": 5, "simple_string_key": "Some some string",'
      + ' "simple_array_key": "Some some value,some other value", "simple_object_key": "Some [object Object]",'
      + ' "simple_int_key": 5 }';

    expect(utils.keywordReplace(kwContents, mappings)).to.deep.equal(kwExpectations);
    done();
  });

  it('should flatten', () => {
    const flat = utils.flatten([ [ 1, 2 ], [ 3, 4 ] ]);
    expect(flat).to.deep.equal([ 1, 2, 3, 4 ]);
  });

  it('should dump json', () => {
    expect(utils.dumpJSON(expectations, 2)).to.deep.equal(JSON.stringify(expectations, null, 2));
  });

  it('should strip fields', () => {
    const obj = {
      a: 'field',
      other: {
        deep: 'field'
      }
    };
    expect(utils.stripFields(obj, [ 'a', 'other.deep', 'notexist' ])).to.deep.equal({ other: {} });
  });

  it('should duplicate items', () => {
    const items = [
      { id: '1', test: 'aa' },
      { id: '1', test: 'zz' },
      { id: '2', test: 'bb' },
      { id: '3', test: 'cc' }
    ];

    const duplicates = [
      [
        { id: '1', test: 'aa' },
        { id: '1', test: 'zz' }
      ]
    ];

    expect(utils.duplicateItems(items, 'id')).to.deep.equal(duplicates);
  });

  it('should replace client names with IDs or fallback', () => {
    const clients = [
      { client_id: '1', name: 'aa' },
      { client_id: '2', name: 'bb' },
      { client_id: '3', name: 'cc' }
    ];

    const names = [ 'dd', 'cc', 'aa' ];

    const expected = [ '1', '3', 'dd' ];

    expect(utils.convertClientNamesToIds(names, clients).sort()).to.deep.equal(expected);
  });
});

describe('#utils calcChanges', () => {
  class MockHandler extends DefaultHandler {
    constructor(settings = {}) {
      const config = configFactory(() => undefined);
      // eslint-disable-next-line no-restricted-syntax
      for (const key of Object.keys(settings)) {
        config.setValue(key, settings[key]);
      }

      super({
        config,
        type: 'mock'
      });
    }
  }

  const mockHandler = new MockHandler();

  const mockHandlerWithObjectFields = (() => {
    const handler = new MockHandler();
    handler.objectFields = [ 'metadata' ];
    return handler;
  })();

  it('should calc create', () => {
    const existing = [ { name: 'Name1', id: 'id1' } ];
    const assets = [
      { name: 'Name1', id: 'id3' },
      { name: 'Create1', id: 'Create1' }
    ];

    const { create } = utils.calcChanges(mockHandler, assets, existing, [ 'id', 'name' ]);

    expect(create).to.have.length(1);
    expect(create).to.deep.include({ name: 'Create1', id: 'Create1' });
  });

  it('should calc create grouped identifiers', () => {
    const existing = [ { client_id: 'client1', audience: 'audience1', id: 'id1' } ];
    const assets = [
      { client_id: 'client1', audience: 'audience1', id: 'id3' },
      { client_id: 'create1', audience: 'create1', id: 'create1' }
    ];

    const { create } = utils.calcChanges(mockHandler, assets, existing, [ 'id', [ 'client_id', 'audience' ] ]);

    expect(create).to.have.length(1);
    expect(create).to.deep.include({ client_id: 'create1', audience: 'create1', id: 'create1' });
  });

  it('should calc delete', () => {
    const existing = [
      { name: 'Name1', id: 'id3' },
      { name: 'Delete1', id: 'Delete1' }
    ];
    const assets = [ { name: 'Name1', id: 'id1' } ];

    const { del } = utils.calcChanges(mockHandler, assets, existing, [ 'id', 'name' ]);

    expect(del).to.have.length(1);
    expect(del).to.deep.include({ name: 'Delete1', id: 'Delete1' });
  });

  it('should calc update', () => {
    const existing = [
      { name: 'Name1', id: 'id3' },
      { name: 'Update1', id: 'Update1' }
    ];
    const assets = [ { name: 'Name1', id: 'id1' } ];

    const { update } = utils.calcChanges(mockHandler, assets, existing, [ 'id', 'name' ]);

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
          should_be_removed: 'should_be_removed'
        }
      }
    ];
    const assets = [
      {
        id: 'id3',
        metadata: {
          should_be_preserved: 'should_be_preserved',
          should_be_changed: 'was_changed',
          should_be_added: 'was_added'
        }
      }
    ];

    const { update: updateWithoutAllowDelete } = utils.calcChanges(
      mockHandlerWithObjectFields,
      assets,
      existing,
      [ 'id' ],
      false
    );

    expect(updateWithoutAllowDelete).to.have.length(1);
    expect(updateWithoutAllowDelete).to.deep.include({
      id: 'id3',
      metadata: {
        should_be_preserved: 'should_be_preserved',
        should_be_changed: 'was_changed',
        should_be_added: 'was_added'
      }
    });

    const { update: updateWithAllowDelete } = utils.calcChanges(
      mockHandlerWithObjectFields,
      assets,
      existing,
      [ 'id' ],
      true
    );

    expect(updateWithAllowDelete).to.have.length(1);
    expect(updateWithAllowDelete).to.deep.include({
      id: 'id3',
      metadata: {
        should_be_preserved: 'should_be_preserved',
        should_be_changed: 'was_changed',
        should_be_removed: null,
        should_be_added: 'was_added'
      }
    });
  });

  it('should skip emptying objectFields when ALLOW_DELETE is not enabled', () => {
    const existing = [
      {
        id: 'id1',
        metadata: {
          should_be_removed: 'should_be_removed'
        }
      },
      {
        id: 'id2',
        metadata: {
          should_be_removed: 'should_be_removed'
        }
      }
    ];
    const assets = [
      {
        id: 'id1',
        // An empty objectField should signal deletion
        metadata: {}
      },
      {
        id: 'id2'
        // A missing objectField should also signal deletion
      }
    ];

    const { update: updateWithoutAllowDelete } = utils.calcChanges(
      mockHandlerWithObjectFields,
      assets,
      existing,
      [ 'id' ],
      false
    );

    expect(updateWithoutAllowDelete).to.have.length(2);
    expect(updateWithoutAllowDelete).to.deep.include({
      id: 'id1'
    });
    expect(updateWithoutAllowDelete).to.deep.include({
      id: 'id2'
    });

    const { update: updateWithAllowDelete } = utils.calcChanges(
      mockHandlerWithObjectFields,
      assets,
      existing,
      [ 'id' ],
      true
    );

    expect(updateWithAllowDelete).to.have.length(2);
    expect(updateWithAllowDelete).to.deep.include({
      id: 'id1',
      metadata: {}
    });
    expect(updateWithAllowDelete).to.deep.include({
      id: 'id2',
      metadata: {}
    });
  });

  it('should calc update grouped identifiers', () => {
    const existing = [
      { client_id: 'client1', audience: 'audience1', id: 'id1' },
      { client_id: 'Update1', audience: 'Update1', id: 'Update1' }
    ];
    const assets = [ { client_id: 'client1', audience: 'audience1', id: 'id3' } ];

    const { update } = utils.calcChanges(mockHandler, assets, existing, [ 'id', [ 'client_id', 'audience' ] ]);

    expect(update).to.have.length(1);
    expect(update).to.deep.include({ client_id: 'client1', audience: 'audience1', id: 'id3' });
  });

  it('should filter excluded items', () => {
    const changes = {
      del: [ { name: 'excluded_delete' }, { name: 'delete' } ],
      create: [ { name: 'excluded_create' }, { name: 'create' } ],
      update: [ { name: 'excluded_update' }, { name: 'update' } ],
      conflicts: [ { name: 'excluded_conflicts' }, { name: 'conflicts' } ]
    };

    const exclude = [ 'excluded_create', 'excluded_update', 'excluded_delete', 'excluded_conflicts' ];

    const result = utils.filterExcluded(changes, exclude);

    expect(Object.keys(result)).to.have.length(4);
    expect(result).to.deep.equal({
      del: [ { name: 'delete' } ],
      create: [ { name: 'create' } ],
      update: [ { name: 'update' } ],
      conflicts: [ { name: 'conflicts' } ]
    });
  });
});

describe('#utils processChangedObjectFields', () => {
  // export function processChangedObjectFields(handler, desiredAssetState, currentAssetState, objectFields = [], allowDelete = false) {

  const handler = {
    objectFields: [
      'client_metadata'
    ],
    objString: () => { }
  };

  it('should propose no changes if object field of current and desired states are both empty', () => {
    const desiredObjectFieldState = utils.processChangedObjectFields({
      handler, currentAssetState: {}, desiredAssetState: {}, allowDelete: false
    });
    expect(desiredObjectFieldState).to.deep.equal({});

    const desiredObjectFieldStateWithDelete = utils.processChangedObjectFields({
      handler, currentAssetState: {}, desiredAssetState: {}, allowDelete: true
    });
    expect(desiredObjectFieldStateWithDelete).to.deep.equal({});
  });

  it('should propose no change if object field exists in both current and desired states', () => {
    const currentAssetState = {
      client_metadata: {
        foo: 'bar'
      }
    };

    const desiredAssetState = {
      client_metadata: {
        foo: 'bar'
      }
    };

    const desiredObjectFieldState = utils.processChangedObjectFields({
      handler, currentAssetState, desiredAssetState, allowDelete: false
    });
    expect(desiredObjectFieldState).to.deep.equal(desiredAssetState);
  });

  it('should propose no change if object field exists in current state but not in the desired state and not allowing deletes', () => {
    const currentAssetState = {
      client_metadata: {
        foo: 'bar'
      }
    };

    const desiredAssetState = {
      client_metadata: {}
    };

    const desiredObjectFieldState = utils.processChangedObjectFields({
      handler, currentAssetState, desiredAssetState, allowDelete: false
    });
    expect(desiredObjectFieldState).to.deep.equal({});
  });

  it('should propose to delete the object field if exists in current state but not in the desired state and are allowing deletes', () => {
    const currentAssetState = {
      client_metadata: {
        foo: 'bar'
      }
    };

    const desiredAssetState = {
      client_metadata: {}
    };

    const desiredObjectFieldState = utils.processChangedObjectFields({
      handler, currentAssetState, desiredAssetState, allowDelete: true
    });
    expect(desiredObjectFieldState).to.deep.equal({ client_metadata: {} });
  });

  it('should propose no change if object field exists in desired state but not in the current state and not allowing deletes', () => {
    const currentAssetState = {
      client_metadata: {}
    };

    const desiredAssetState = {
      client_metadata: {
        foo: 'bar'
      }
    };

    const desiredObjectFieldState = utils.processChangedObjectFields({
      handler, currentAssetState, desiredAssetState, allowDelete: false
    });
    expect(desiredObjectFieldState).to.deep.equal(desiredAssetState);
  });
});
