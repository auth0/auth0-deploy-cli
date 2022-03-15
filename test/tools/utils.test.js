import path from 'path';
import { expect } from 'chai';
import * as utils from '../../src/tools/utils';

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
    const loaded = utils.loadFileAndReplaceKeywords(file, mappings);
    expect(JSON.parse(loaded)).to.deep.equal(expectations);
  });

  it('should throw error if cannot load file', () => {
    expect(function() {
      utils.loadFileAndReplaceKeywords('notexist.json', mappings);
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

describe('#keywordReplacement', () => {
  it('should replace string keywords and array keywords in a JSON file', () => {
    const mapping = {
      ARRAY_REPLACEMENT: [ 'foo', 'bar' ],
      STRING_REPLACEMENT: 'baz',
      OTHER_REPLACEMENT: 'lol'
    };
    const inputJSON = '{ "arrayReplaceNoQuotes": @@ARRAY_REPLACEMENT@@, "arrayReplaceWithQuotes": "@@ARRAY_REPLACEMENT@@", "stringReplace": "##STRING_REPLACEMENT##", "noReplace": "OTHER_REPLACEMENT" }';
    const output = utils.keywordReplace(inputJSON, mapping);

    expect(() => JSON.parse(output)).to.not.throw();

    expect(output).to.equal(`{ "arrayReplaceNoQuotes": ${JSON.stringify(mapping.ARRAY_REPLACEMENT)}, "arrayReplaceWithQuotes": ${JSON.stringify(mapping.ARRAY_REPLACEMENT)}, "stringReplace": "${mapping.STRING_REPLACEMENT}", "noReplace": "OTHER_REPLACEMENT" }`);
  });

  it('should replace keywords in YAML file', () => {
    const mapping = {
      ARRAY_REPLACEMENT: [ 'foo', 'bar' ],
      STRING_REPLACEMENT: 'baz',
      OTHER_REPLACEMENT: 'lol'
    };

    const inputYAML = `
    ---
    stringReplaceNoQuotes: ##STRING_REPLACEMENT##
    stringReplaceWithQuotes: "##STRING_REPLACEMENT##"
    arrayReplace: @@ARRAY_REPLACEMENT@@
    arrayReplaceWithQuotes: "@@ARRAY_REPLACEMENT@@"
    noReplace: OTHER_REPLACEMENT
    `;

    const output = utils.keywordReplace(inputYAML, mapping);

    const expectedOutputYAML = `
    ---
    stringReplaceNoQuotes: ${mapping.STRING_REPLACEMENT}
    stringReplaceWithQuotes: "${mapping.STRING_REPLACEMENT}"
    arrayReplace: ["foo","bar"]
    arrayReplaceWithQuotes: ["foo","bar"]
    noReplace: OTHER_REPLACEMENT
    `;

    expect(output).to.equal(expectedOutputYAML);
  });

  describe('#keywordStringReplace', () => {
    const mapping = {
      STRING_REPLACEMENT: 'foo',
      OTHER_REPLACEMENT: 'bar'
    };

    it('should not replace values not wrapped in ##', () => {
      const input = '{ "foo": STRING_REPLACEMENT, "bar": "STRING_REPLACEMENT" }';
      const output = utils.keywordStringReplace(input, mapping);
      expect(output).to.equal(input);
    });

    it('should replace ## wrapped values', () => {
      const output = utils.keywordStringReplace('{ "foo": "##STRING_REPLACEMENT##", "bar": "OTHER_REPLACEMENT" }', mapping);
      expect(output).to.equal(`{ "foo": "${mapping.STRING_REPLACEMENT}", "bar": "OTHER_REPLACEMENT" }`);
    });

    it('should replace ## wrapped values and maintain quotes', () => {
      const output = utils.keywordStringReplace('{ "foo": ##STRING_REPLACEMENT##, "bar": "OTHER_REPLACEMENT" }', mapping);
      expect(output).to.equal(`{ "foo": ${mapping.STRING_REPLACEMENT}, "bar": "OTHER_REPLACEMENT" }`);
    });
  });

  describe('#keywordArrayReplace', () => {
    const mapping = {
      ARRAY_REPLACEMENT: [ 'foo', 'bar' ],
      OTHER_REPLACEMENT: 'baz'
    };

    it('should not replace values not wrapped in @@', () => {
      const input = '{ "foo": ARRAY_REPLACEMENT, "bar": "ARRAY_REPLACEMENT" }';
      const output = utils.keywordArrayReplace(input, mapping);
      expect(output).to.equal(input);
    });

    it('should replace @@ wrapped values', () => {
      const output = utils.keywordArrayReplace('{ "foo": @@ARRAY_REPLACEMENT@@, "bar": "OTHER_REPLACEMENT" }', mapping);
      const parsedOutput = JSON.parse(output);
      expect(parsedOutput).to.deep.equal({ foo: mapping.ARRAY_REPLACEMENT, bar: 'OTHER_REPLACEMENT' });
    });

    it('should replace @@ wrapped values, even when wrapped with quotes', () => {
      const inputWrappedInQuotes = '{ "foo": "@@ARRAY_REPLACEMENT@@", "bar": "OTHER_REPLACEMENT"}';
      const output = utils.keywordArrayReplace(inputWrappedInQuotes, mapping);
      const parsedOutput = JSON.parse(output);
      expect(parsedOutput).to.deep.equal({ foo: mapping.ARRAY_REPLACEMENT, bar: 'OTHER_REPLACEMENT' });
    });
  });
});

describe('#filterExcluded', () => {
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
