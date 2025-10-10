import path from 'path';
import { readFileSync } from 'fs';
import { expect } from 'chai';
import jsYaml from 'js-yaml';
import * as utils from '../../src/tools/utils';
import constants from '../../src/tools/constants';
import log from '../../src/logger';

const mappings = {
  string: 'some string',
  array: ['some value', 'some other value'],
  object: {
    key1: 'value1',
    key2: 'value2',
  },
  int: 5,
};

const expectations = {
  a: 1,
  array_key: ['some value', 'some other value'],
  int_key: 5,
  object_key: {
    key1: 'value1',
    key2: 'value2',
  },
  simple_array_key: "Some'some value,some other value",
  simple_int_key: 5,
  simple_object_key: 'Some [object Object]',
  simple_string_key: 'Some some string',
  string_key: 'some string',
};

describe('#utils', function () {
  it('should load file and replace keywords', () => {
    const file = path.resolve(__dirname, 'test.file.json');
    const loaded = utils.loadFileAndReplaceKeywords(file, {
      mappings,
      disableKeywordReplacement: false,
    });
    expect(JSON.parse(loaded)).to.deep.equal(expectations);
  });

  it('should load file and not replace keywords', () => {
    const file = path.resolve(__dirname, 'test.file.json');
    const loaded = utils.loadFileAndReplaceKeywords(file, {
      mappings,
      disableKeywordReplacement: true,
    });
    expect(loaded).to.deep.equal(readFileSync(file).toString());
  });

  it('should throw error if cannot load file', () => {
    expect(function () {
      utils.loadFileAndReplaceKeywords('notexist.json', {
        mappings,
        disableKeywordReplacement: context.disableKeywordReplacement,
      });
    }).to.throw(/Unable to load file.*/);
  });

  describe('wrapArrayReplaceMarkersInQuotes', () => {
    it('should wrap @@ARRAY_KEYWORD@@ markers in quotes', () => {
      const yaml = `
      property:
      - name: some-item
        value: @@VALID_ARRAY_KEYWORD@@
      - name: another-item
        value: @@VALID_ARRAY_KEYWORD@@`;

      const escapedYaml = utils.wrapArrayReplaceMarkersInQuotes(yaml, {
        VALID_ARRAY_KEYWORD: [],
      });
      expect(escapedYaml).to.equal(`
      property:
      - name: some-item
        value: "@@VALID_ARRAY_KEYWORD@@"
      - name: another-item
        value: "@@VALID_ARRAY_KEYWORD@@"`);
      expect(() => jsYaml.load(escapedYaml)).to.not.throw();
    });

    it('should not wrap @@ARRAY_KEYWORD@@ markers in quotes if it is already wrapped', () => {
      const yaml = `
      property:
      - name: some-item
        value: "@@VALID_ARRAY_KEYWORD@@"
      - name: some-single-quoted-item
        value: '@@VALID_ARRAY_KEYWORD@@'
      - name: another-item
        value: "@@VALID_ARRAY_KEYWORD@@"`;

      const escapedYaml = utils.wrapArrayReplaceMarkersInQuotes(yaml, {
        VALID_ARRAY_KEYWORD: [],
      });
      expect(escapedYaml).to.equal(`
      property:
      - name: some-item
        value: "@@VALID_ARRAY_KEYWORD@@"
      - name: some-single-quoted-item
        value: '@@VALID_ARRAY_KEYWORD@@'
      - name: another-item
        value: "@@VALID_ARRAY_KEYWORD@@"`);
      expect(() => jsYaml.load(escapedYaml)).to.not.throw();
    });

    it('should not wrap @@ARRAY_KEYWORD@@ markers in quotes if keyword does not exist in mapping', () => {
      const yaml = `
      property:
      - name: some-item
        value: @@NOT_IN_KEYWORD_MAPPINGS@@`;

      const escapedYaml = utils.wrapArrayReplaceMarkersInQuotes(yaml, {});
      expect(escapedYaml).to.equal(yaml);
      expect(() => jsYaml.load(escapedYaml)).to.throw(); // Because it is invalid yaml
    });
  });

  it('should do keyword replacements', (done) => {
    const kwContents =
      '{ "a": 1, "string_key": @@string@@, "array_key": @@array@@, "object_key": @@object@@,' +
      ' "int_key": @@int@@, "simple_string_key": "Some ##string##", "simple_array_key": "Some' +
      ' ##array##", "simple_object_key": "Some ##object##", "simple_int_key": ##int## }';

    const kwExpectations =
      '{ "a": 1, "string_key": "some string", "array_key": ["some value","some other value"],' +
      ' "object_key": {"key1":"value1","key2":"value2"}, "int_key": 5, "simple_string_key": "Some some string",' +
      ' "simple_array_key": "Some some value,some other value", "simple_object_key": "Some [object Object]",' +
      ' "simple_int_key": 5 }';

    expect(utils.keywordReplace(kwContents, mappings)).to.deep.equal(kwExpectations);
    done();
  });

  it('should flatten', () => {
    const flat = utils.flatten([
      [1, 2],
      [3, 4],
    ]);
    expect(flat).to.deep.equal([1, 2, 3, 4]);
  });

  it('should dump json', () => {
    expect(utils.convertJsonToString(expectations, 2)).to.deep.equal(
      JSON.stringify(expectations, null, 2)
    );
  });

  it('should strip fields', () => {
    const obj = {
      a: 'field',
      other: {
        deep: 'field',
      },
    };
    expect(utils.stripFields(obj, ['a', 'other.deep', 'notexist'])).to.deep.equal({ other: {} });
  });

  it('should duplicate items', () => {
    const items = [
      { id: '1', test: 'aa' },
      { id: '1', test: 'zz' },
      { id: '2', test: 'bb' },
      { id: '3', test: 'cc' },
    ];

    const duplicates = [
      [
        { id: '1', test: 'aa' },
        { id: '1', test: 'zz' },
      ],
    ];

    expect(utils.duplicateItems(items, 'id')).to.deep.equal(duplicates);
  });

  it('should replace client names with IDs or fallback', () => {
    const clients = [
      { client_id: '1', name: 'aa' },
      { client_id: '2', name: 'bb' },
      { client_id: '3', name: 'cc' },
    ];

    const names = ['dd', 'cc', 'aa'];

    const expected = ['1', '3', 'dd'];

    expect(utils.convertClientNamesToIds(names, clients).sort()).to.deep.equal(expected);
  });
});

describe('#keywordReplacement', () => {
  it('should replace string keywords and array keywords in a JSON file', () => {
    const mapping = {
      ARRAY_REPLACEMENT: ['foo', 'bar'],
      STRING_REPLACEMENT: 'baz',
      OTHER_REPLACEMENT: 'lol',
    };
    const inputJSON =
      '{ "arrayReplaceNoQuotes": @@ARRAY_REPLACEMENT@@, "arrayReplaceWithQuotes": "@@ARRAY_REPLACEMENT@@", "stringReplace": "##STRING_REPLACEMENT##", "noReplace": "OTHER_REPLACEMENT" }';
    const output = utils.keywordReplace(inputJSON, mapping);

    expect(() => JSON.parse(output)).to.not.throw();

    expect(output).to.equal(
      `{ "arrayReplaceNoQuotes": ${JSON.stringify(
        mapping.ARRAY_REPLACEMENT
      )}, "arrayReplaceWithQuotes": ${JSON.stringify(
        mapping.ARRAY_REPLACEMENT
      )}, "stringReplace": "${mapping.STRING_REPLACEMENT}", "noReplace": "OTHER_REPLACEMENT" }`
    );
  });

  it('should replace keywords in YAML file', () => {
    const mapping = {
      ARRAY_REPLACEMENT: ['foo', 'bar'],
      STRING_REPLACEMENT: 'baz',
      OTHER_REPLACEMENT: 'lol',
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

  it('should perform ## string replacement if nested within an @@ array replacement', () => {
    const mapping = {
      NO_REPLACEMENT: 'no-replace-value',
      STRING_REPLACEMENT: 'string-replace-value',
      ARRAY_REPLACEMENT: ['##STRING_REPLACEMENT##', 'other-array-replace-value'],
    };
    const inputJSON = `{
        "arrayReplace": "@@ARRAY_REPLACEMENT@@",
        "stringReplace": "##STRING_REPLACEMENT##",
        "noReplace": "NO_REPLACEMENT"
      }`;
    const output = utils.keywordReplace(inputJSON, mapping);

    expect(() => JSON.parse(output)).to.not.throw();

    const outputNoWhitespace = JSON.stringify(JSON.parse(output)); // Ensuring conversion can occur back and forth, remove whitespace for test consistency
    const expected = JSON.stringify({
      arrayReplace: ['string-replace-value', 'other-array-replace-value'],
      stringReplace: 'string-replace-value',
      noReplace: 'NO_REPLACEMENT',
    });

    expect(outputNoWhitespace).to.equal(expected);
  });

  it('should perform ## string replacement if nested within an @@ object replacement', () => {
    const mapping = {
      NO_REPLACEMENT: 'no-replace-value',
      STRING_REPLACEMENT: 'string-replace-value',
      OBJECT_REPLACEMENT: {
        propertyShouldStringReplace: '##STRING_REPLACEMENT##',
        propertyShouldNotStringReplace: 'this should not be replaced',
      },
    };
    const inputJSON = `{
      "stringReplace": "##STRING_REPLACEMENT##",
      "noReplace": "NO_REPLACEMENT",
      "objectReplace": "@@OBJECT_REPLACEMENT@@"
      }`;
    const output = utils.keywordReplace(inputJSON, mapping);

    expect(() => JSON.parse(output)).to.not.throw();

    const outputNoWhitespace = JSON.stringify(JSON.parse(output)); // Ensuring conversion can occur back and forth, remove whitespace for test consistency
    const expected = JSON.stringify({
      stringReplace: 'string-replace-value',
      noReplace: 'NO_REPLACEMENT',
      objectReplace: {
        propertyShouldStringReplace: 'string-replace-value',
        propertyShouldNotStringReplace: 'this should not be replaced',
      },
    });

    expect(outputNoWhitespace).to.equal(expected);
  });

  describe('#array concatenation with keyword replacement', function () {
    it('should concatenate string array values in directory format with workaround', () => {
      const mapping = {
        // prettier-ignore
        GLOBAL_WEB_ORIGINS: "\"http://local.me:8080\", \"http://localhost\", \"http://localhost:3000\"", // eslint-disable-line
      };

      const inputJSON = `{
      "web_origins": [
        ##GLOBAL_WEB_ORIGINS##,
        "http://production-app.com",
        "https://production-app.com"
      ]
    }`;

      const output = utils.keywordReplace(inputJSON, mapping);

      expect(() => JSON.parse(output)).to.not.throw();

      const parsed = JSON.parse(output);

      expect(parsed.web_origins).to.deep.equal([
        'http://local.me:8080',
        'http://localhost',
        'http://localhost:3000',
        'http://production-app.com',
        'https://production-app.com',
      ]);
    });

    it('should concatenate string array values in YAML format with workaround', () => {
      const mapping = {
        // prettier-ignore
        GLOBAL_WEB_ORIGINS: "\"http://local.me:8080\", \"http://localhost\", \"http://localhost:3000\"", // eslint-disable-line
      };

      const inputYAML =
        'web_origins: [ ##GLOBAL_WEB_ORIGINS## , "http://production-app.com", "https://production-app.com"]';

      const output = utils.keywordReplace(inputYAML, mapping);

      const parsed = jsYaml.load(output);

      expect(parsed.web_origins).to.deep.equal([
        'http://local.me:8080',
        'http://localhost',
        'http://localhost:3000',
        'http://production-app.com',
        'https://production-app.com',
      ]);
    });
  });

  describe('#keywordStringReplace', () => {
    const mapping = {
      STRING_REPLACEMENT: 'foo',
      OTHER_REPLACEMENT: 'bar',
    };

    it('should not replace values not wrapped in ##', () => {
      const input = '{ "foo": STRING_REPLACEMENT, "bar": "STRING_REPLACEMENT" }';
      const output = utils.keywordStringReplace(input, mapping);
      expect(output).to.equal(input);
    });

    it('should replace ## wrapped values', () => {
      const output = utils.keywordStringReplace(
        '{ "foo": "##STRING_REPLACEMENT##", "bar": "OTHER_REPLACEMENT" }',
        mapping
      );
      expect(output).to.equal(
        `{ "foo": "${mapping.STRING_REPLACEMENT}", "bar": "OTHER_REPLACEMENT" }`
      );
    });

    it('should replace ## wrapped values and maintain quotes', () => {
      const output = utils.keywordStringReplace(
        '{ "foo": ##STRING_REPLACEMENT##, "bar": "OTHER_REPLACEMENT" }',
        mapping
      );
      expect(output).to.equal(
        `{ "foo": ${mapping.STRING_REPLACEMENT}, "bar": "OTHER_REPLACEMENT" }`
      );
    });

    // Issue #1153: Test cases for $ character handling
    it('should handle dollar-apostrophe in replacement value', () => {
      const input = '{ "secret": "##PASSWORD##" }';
      const passwordMapping = { PASSWORD: "'mySecret$'" };
      const output = utils.keywordStringReplace(input, passwordMapping);
      expect(output).to.equal('{ "secret": "\'mySecret$\'" }');
      expect(() => JSON.parse(output)).to.not.throw();
    });
  });

  describe('#keywordArrayReplace', () => {
    const mapping = {
      ARRAY_REPLACEMENT: ['foo', 'bar'],
      OTHER_REPLACEMENT: 'baz',
    };

    it('should not replace values not wrapped in @@', () => {
      const input = '{ "foo": ARRAY_REPLACEMENT, "bar": "ARRAY_REPLACEMENT" }';
      const output = utils.keywordArrayReplace(input, mapping);
      expect(output).to.equal(input);
    });

    it('should replace @@ wrapped values', () => {
      const output = utils.keywordArrayReplace(
        '{ "foo": @@ARRAY_REPLACEMENT@@, "bar": "OTHER_REPLACEMENT" }',
        mapping
      );
      const parsedOutput = JSON.parse(output);
      expect(parsedOutput).to.deep.equal({
        foo: mapping.ARRAY_REPLACEMENT,
        bar: 'OTHER_REPLACEMENT',
      });
    });

    it('should replace @@ wrapped values, even when wrapped with quotes in JSON format', () => {
      const inputWrappedInQuotes = '{ "foo": "@@ARRAY_REPLACEMENT@@", "bar": "OTHER_REPLACEMENT"}';
      const output = utils.keywordArrayReplace(inputWrappedInQuotes, mapping);
      const parsedOutput = JSON.parse(output);
      expect(parsedOutput).to.deep.equal({
        foo: mapping.ARRAY_REPLACEMENT,
        bar: 'OTHER_REPLACEMENT',
      });
    });

    it('should replace @@ wrapped values, even when wrapped with quotes in YAML format', () => {
      const inputWrappedInQuotes = `
        singleQuotes: '@@ARRAY_REPLACEMENT@@'
        doubleQuotes: "@@ARRAY_REPLACEMENT@@"`;

      const output = utils.keywordArrayReplace(inputWrappedInQuotes, mapping);
      const parsedOutput = jsYaml.load(output);
      expect(parsedOutput).to.deep.equal({
        singleQuotes: mapping.ARRAY_REPLACEMENT,
        doubleQuotes: mapping.ARRAY_REPLACEMENT,
      });
    });

    // Issue #1153: Test cases for $ character handling in arrays
    it('should handle dollar-apostrophe in array values', () => {
      const input = '{ "keys": @@KEYS@@ }';
      const arrayMapping = { KEYS: ["api-key$'", "secret$'"] };
      const output = utils.keywordArrayReplace(input, arrayMapping);
      expect(() => JSON.parse(output)).to.not.throw();
      const parsed = JSON.parse(output);
      expect(parsed.keys).to.deep.equal(arrayMapping.KEYS);
    });
  });
});

describe('#filterExcluded', () => {
  it('should filter excluded items', () => {
    const changes = {
      del: [{ name: 'excluded_delete' }, { name: 'delete' }],
      create: [{ name: 'excluded_create' }, { name: 'create' }],
      update: [{ name: 'excluded_update' }, { name: 'update' }],
      conflicts: [{ name: 'excluded_conflicts' }, { name: 'conflicts' }],
    };

    const exclude = ['excluded_create', 'excluded_update', 'excluded_delete', 'excluded_conflicts'];

    const result = utils.filterExcluded(changes, exclude);

    expect(Object.keys(result)).to.have.length(4);
    expect(result).to.deep.equal({
      del: [{ name: 'delete' }],
      create: [{ name: 'create' }],
      update: [{ name: 'update' }],
      conflicts: [{ name: 'conflicts' }],
    });
  });

  describe('#obfuscateSensitiveValues', () => {
    it('should obfuscate sensitive values for single asset', () => {
      const asset = {
        id: 'asset-id-100',
        name: 'some asset',
        status: 'active',
        http: {
          authorization: 'sensitive-token',
        },
      };

      const obfuscatedAsset = utils.obfuscateSensitiveValues(asset, ['http.authorization']);
      expect(obfuscatedAsset).to.deep.equal({
        ...asset,
        http: {
          authorization: '_VALUE_NOT_SHOWN_',
        },
      });
    });

    it('should obfuscate sensitive values for a set of assets', () => {
      const assets = [
        {
          id: 'asset-id-1',
          http: {
            authorization: 'sensitive-token-to-obfuscate-1',
          },
        },
        {
          id: 'asset-id-2',
          secret: 'some-different-secret-to-obfuscate',
        },
        {
          id: 'asset-id-3',
          http: {
            authorization: 'sensitive-token-to-obfuscate-3',
          },
        },
      ];

      const obfuscatedAssets = utils.obfuscateSensitiveValues(assets, [
        'secret',
        'http.authorization',
      ]);
      expect(obfuscatedAssets).to.deep.equal(
        assets.map((asset) => {
          if (asset?.secret) asset.secret = '_VALUE_NOT_SHOWN_';
          if (asset?.http?.authorization) asset.http.authorization = '_VALUE_NOT_SHOWN_';
          return asset;
        })
      );
    });
  });

  describe('#stripObfuscatedFieldsFromPayload', () => {
    it('should remove obfuscated values for API payload if contains designated obfuscation value', () => {
      const asset = {
        id: 'asset-id-100',
        name: 'some asset',
        http: {
          status: 'active',
          authorization: constants.OBFUSCATED_SECRET_VALUE,
        },
      };

      const obfuscatedAsset = utils.stripObfuscatedFieldsFromPayload(asset, ['http.authorization']);
      expect(obfuscatedAsset).to.deep.equal({
        ...asset,
        http: {
          status: asset.http.status,
          // authorization property omitted
        },
      });
    });

    it('should remove obfuscated values for API payload of multiple assets if contains designated obfuscation value', () => {
      const assets = [
        {
          id: 'asset-id-1',
          http: {
            authorization: constants.OBFUSCATED_SECRET_VALUE,
          },
        },
        {
          id: 'asset-id-2',
          secret: constants.OBFUSCATED_SECRET_VALUE,
        },
        {
          id: 'asset-id-3',
          http: {
            authorization: constants.OBFUSCATED_SECRET_VALUE,
          },
        },
      ];

      const strippedPayload = utils.stripObfuscatedFieldsFromPayload(assets, [
        'secret',
        'http.authorization',
      ]);
      expect(strippedPayload).to.deep.equal(
        assets.map((asset) => {
          delete asset.secret;
          if (asset.http) delete asset.http.authorization;
          return asset;
        })
      );
    });
  });
});

describe('#detectInsufficientScopeError', () => {
  it('should execute passed callback if no error detected', async () => {
    let didCallbackGetCalled = false;

    const mockReturnData = 'expect this to be returned';

    const { requiredScopes, data, hadSufficientScopes } = await utils.detectInsufficientScopeError(
      () => {
        didCallbackGetCalled = true;
        return mockReturnData;
      }
    );

    expect(data).to.equal(mockReturnData);
    expect(hadSufficientScopes).to.equal(true);
    expect(requiredScopes).to.deep.equal([]);
    expect(didCallbackGetCalled).to.equal(true);
  });

  it('should detect insufficient scope error', async () => {
    let didCallbackGetCalled = false;

    const requiredScope = 'read:clients';
    const { hadSufficientScopes, data, requiredScopes } = await utils.detectInsufficientScopeError(
      () => {
        didCallbackGetCalled = true;
        // eslint-disable-next-line no-throw-literal
        throw {
          statusCode: 403,
          message: `Insufficient scope, expected any of: ${requiredScope}`,
        };
      }
    );

    expect(hadSufficientScopes).to.equal(false);
    expect(requiredScopes).to.deep.equal([requiredScope]);
    expect(data).to.equal(null);
    expect(didCallbackGetCalled).to.equal(true);
  });

  it('should bubble-up error if not an insufficient scope error', async () => {
    let didThrow = false;

    const mockError = {
      statusCode: 403,
      message: 'Some other type of access issue',
    };

    try {
      await utils.detectInsufficientScopeError(() => {
        throw mockError;
      });
    } catch (error) {
      didThrow = true;
      expect(error).to.equal(mockError);
    }

    expect(didThrow).to.equal(true);
  });
});

describe('#isDeprecatedError', () => {
  it('should return true if deprecated error', async () => {
    const error = {
      message: 'Insufficient privileges to use this deprecated feature',
      statusCode: 403,
    };
    // eslint-disable-next-line no-unused-expressions
    expect(utils.isDeprecatedError(error)).to.be.true;
  });

  it('should return false if not a deprecated error', async () => {
    const error = {
      message: 'Not found',
      statusCode: 404,
    };
    // eslint-disable-next-line no-unused-expressions
    expect(utils.isDeprecatedError(error)).to.be.false;
  });

  it('should return false error is not error types', async () => {
    // eslint-disable-next-line no-unused-expressions
    expect(utils.isDeprecatedError(undefined)).to.be.false;
    // eslint-disable-next-line no-unused-expressions
    expect(utils.isDeprecatedError({})).to.be.false;
  });
});

describe('#isForbiddenFeatureError', () => {
  it('should return true and log warning for 403 status code', () => {
    let warnMessage;
    const originalWarn = log.warn;
    // Mock the log.warn function
    log.warn = (msg) => {
      warnMessage = msg;
    };

    const error = {
      message: 'Forbidden resource access',
      statusCode: 403,
    };
    const resourceType = 'connections';

    // eslint-disable-next-line no-unused-expressions
    expect(utils.isForbiddenFeatureError(error, resourceType)).to.be.true;
    expect(warnMessage).to.equal('Forbidden resource access; - Skipping connections');

    // Restore original warn function
    log.warn = originalWarn;
  });

  it('should include errorCode in log message when available', () => {
    let warnMessage;
    const originalWarn = log.warn;
    // Mock the log.warn function
    log.warn = (msg) => {
      warnMessage = msg;
    };

    const error = {
      message: 'Forbidden resource access',
      statusCode: 403,
      errorCode: 'forbidden_resource_error',
    };
    const resourceType = 'actions';

    // eslint-disable-next-line no-unused-expressions
    expect(utils.isForbiddenFeatureError(error, resourceType)).to.be.true;
    expect(warnMessage).to.equal(
      'Forbidden resource access;forbidden_resource_error - Skipping actions'
    );

    // Restore original warn function
    log.warn = originalWarn;
  });

  it('should return false for non-403 status code', () => {
    const error = {
      message: 'Not found',
      statusCode: 404,
    };
    const resourceType = 'rules';

    // eslint-disable-next-line no-unused-expressions
    expect(utils.isForbiddenFeatureError(error, resourceType)).to.be.false;
  });
});

describe('#maskSecretAtPath', () => {
  it('should mask a secret at a simple path', () => {
    const obj = { secret: 'sensitive_value' };

    utils.maskSecretAtPath({
      resourceTypeName: 'connections',
      maskedKeyName: 'oauth2',
      maskOnObj: obj,
      keyJsonPath: 'secret',
    });

    expect(obj.secret).to.equal('##CONNECTIONS_OAUTH2_SECRET##');
  });

  it('should mask a secret at a nested path', () => {
    const obj = {
      config: {
        credentials: {
          client_secret: 'sensitive_secret',
        },
      },
    };

    utils.maskSecretAtPath({
      resourceTypeName: 'connections',
      maskedKeyName: 'samlp',
      maskOnObj: obj,
      keyJsonPath: 'config.credentials.client_secret',
    });

    expect(obj.config.credentials.client_secret).to.equal('##CONNECTIONS_SAMLP_SECRET##');
  });

  it('should not modify object if path does not exist', () => {
    const obj = { other_field: 'value' };
    const originalObj = { ...obj };

    utils.maskSecretAtPath({
      resourceTypeName: 'connections',
      maskedKeyName: 'oauth2',
      maskOnObj: obj,
      keyJsonPath: 'non_existent_path',
    });

    expect(obj).to.deep.equal(originalObj);
  });

  it('should sanitize resource type name with special characters', () => {
    const obj = { token: 'secret_token' };

    utils.maskSecretAtPath({
      resourceTypeName: 'log-streams',
      maskedKeyName: 'http',
      maskOnObj: obj,
      keyJsonPath: 'token',
    });

    expect(obj.token).to.equal('##LOG_STREAMS_HTTP_SECRET##');
  });

  it('should sanitize masked key name with special characters', () => {
    const obj = { apiKey: 'secret_key' };

    utils.maskSecretAtPath({
      resourceTypeName: 'logStreams',
      maskedKeyName: 'custom-http-2.0',
      maskOnObj: obj,
      keyJsonPath: 'apiKey',
    });

    expect(obj.apiKey).to.equal('##LOGSTREAMS_CUSTOM_HTTP_2_0_SECRET##');
  });

  it('should handle numeric values in path', () => {
    const obj = {
      items: [{ secret: 'first_secret' }, { secret: 'second_secret' }],
    };

    utils.maskSecretAtPath({
      resourceTypeName: 'rules',
      maskedKeyName: 'webhook',
      maskOnObj: obj,
      keyJsonPath: 'items.0.secret',
    });

    expect(obj.items[0].secret).to.equal('##RULES_WEBHOOK_SECRET##');
    expect(obj.items[1].secret).to.equal('second_secret'); // Should remain unchanged
  });

  it('should handle deeply nested paths', () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            level4: {
              secret_value: 'deeply_nested_secret',
            },
          },
        },
      },
    };

    utils.maskSecretAtPath({
      resourceTypeName: 'actions',
      maskedKeyName: 'login',
      maskOnObj: obj,
      keyJsonPath: 'level1.level2.level3.level4.secret_value',
    });

    expect(obj.level1.level2.level3.level4.secret_value).to.equal('##ACTIONS_LOGIN_SECRET##');
  });

  it('should return the modified object', () => {
    const obj = { token: 'secret_token' };

    const result = utils.maskSecretAtPath({
      resourceTypeName: 'hooks',
      maskedKeyName: 'post_login',
      maskOnObj: obj,
      keyJsonPath: 'token',
    });

    expect(result).to.equal(obj);
    expect(result.token).to.equal('##HOOKS_POST_LOGIN_SECRET##');
  });

  it('should handle empty strings in resource and key names', () => {
    const obj = { secret: 'value' };

    utils.maskSecretAtPath({
      resourceTypeName: '',
      maskedKeyName: '',
      maskOnObj: obj,
      keyJsonPath: 'secret',
    });

    expect(obj.secret).to.equal('##__SECRET##');
  });

  it('should handle array objects', () => {
    const obj = {
      configs: [{ auth_token: 'token1' }, { auth_token: 'token2' }, { auth_token: 'token3' }],
    };

    utils.maskSecretAtPath({
      resourceTypeName: 'phoneProviders',
      maskedKeyName: 'twilio',
      maskOnObj: obj,
      keyJsonPath: 'configs.1.auth_token',
    });

    expect(obj.configs[0].auth_token).to.equal('token1');
    expect(obj.configs[1].auth_token).to.equal('##PHONEPROVIDERS_TWILIO_SECRET##');
    expect(obj.configs[2].auth_token).to.equal('token3');
  });
});
