import { expect } from 'chai';
import { get as getDotNotation } from 'dot-prop';
import {
  shouldFieldBePreserved,
  getPreservableFieldsFromAssets,
  getAssetsValueByAddress,
  convertAddressToDotNotation,
  updateAssetsByAddress,
  preserveKeywords,
} from '../src/keywordPreservation';
import { cloneDeep } from 'lodash';

describe('#Keyword Preservation', () => {
  describe('shouldFieldBePreserved', () => {
    it('should return false when field does not contain keyword markers', () => {
      const keywordMappings = {
        BAR: 'bar',
      };
      expect(shouldFieldBePreserved('', keywordMappings)).to.be.false;
      expect(shouldFieldBePreserved('this is a field without a keyword marker', keywordMappings)).to
        .be.false;
      expect(shouldFieldBePreserved('this field has an invalid @keyword@ marker', keywordMappings))
        .to.be.false;
    });

    it('should return false when field contain keyword markers but are absent in keyword mappings', () => {
      const keywordMappings = {
        BAR: 'bar',
      };
      expect(shouldFieldBePreserved('##FOO##', keywordMappings)).to.be.false;
      expect(shouldFieldBePreserved('@@FOO@@', keywordMappings)).to.be.false;
      expect(shouldFieldBePreserved('this field has a @@FOO@@ marker', keywordMappings)).to.be
        .false;
    });

    it('should return true when field contain keyword markers that exist in keyword mappings', () => {
      const keywordMappings = {
        FOO: 'foo keyword',
        BAR: 'bar keyword',
        ARRAY: ['foo', 'bar'],
      };
      expect(shouldFieldBePreserved('##FOO##', keywordMappings)).to.be.true;
      expect(shouldFieldBePreserved('@@FOO@@', keywordMappings)).to.be.true;
      expect(shouldFieldBePreserved('this field has a ##FOO## marker', keywordMappings)).to.be.true;
      expect(
        shouldFieldBePreserved('this field has both a ##FOO## and ##BAR## marker', keywordMappings)
      ).to.be.true;
    });
  });

  describe('getPreservableFieldsFromAssets', () => {
    it('should retrieve all preservable fields from assets tree', () => {
      const fieldsToPreserve = getPreservableFieldsFromAssets(
        {
          object: {
            friendly_name: 'Friendly name ##KEYWORD##',
            notInKeywordMapping: '##NOT_IN_KEYWORD_MAPPING##',
            number: 5,
            boolean: true,
            nested: {
              nestedProperty: 'Nested property ##KEYWORD##',
            },
          },
          array: [
            {
              name: 'array-item-1',
              nestedArray: [
                {
                  name: 'nested-array-item-1',
                  value: 'Nested array value 1 ##KEYWORD##',
                },
                {
                  name: 'nested-array-item-2',
                  value: 'Nested array value 2 ##KEYWORD##',
                },
              ],
              notInKeywordMapping: '##NOT_IN_KEYWORD_MAPPING##',
              nested: {
                nestedProperty: 'Another nested array property ##KEYWORD##',
              },
            },
          ],
          arrayReplace: '@@ARRAY_REPLACE_KEYWORD@@',
          nullField: null,
          undefinedField: undefined,
        },
        {
          KEYWORD: 'Travel0',
          ARRAY_REPLACE_KEYWORD: ['this value', 'that value'],
        }
      );

      expect(fieldsToPreserve).to.have.members([
        'object.friendly_name',
        'object.nested.nestedProperty',
        'array.[name=array-item-1].nestedArray.[name=nested-array-item-1].value',
        'array.[name=array-item-1].nestedArray.[name=nested-array-item-2].value',
        'array.[name=array-item-1].nested.nestedProperty',
        'arrayReplace',
      ]);
    });
  });
});

describe('getAssetsValueByAddress', () => {
  it('should find the value of the addressed property', () => {
    const mockAssetTree = {
      tenant: {
        display_name: 'This is my tenant display name',
      },
      clients: [
        {
          name: 'client-1',
          display_name: 'Some Display Name',
        },
        {
          name: 'client-2',
          display_name: 'This is the target value',
        },
        {
          name: 'client-3',
          connections: [
            {
              connection_name: 'connection-1',
              display_name: 'My connection display name',
            },
          ],
        },
      ],
    };

    expect(getAssetsValueByAddress('tenant.display_name', mockAssetTree)).to.equal(
      'This is my tenant display name'
    );
    expect(getAssetsValueByAddress('clients.[name=client-2].display_name', mockAssetTree)).to.equal(
      'This is the target value'
    );
    expect(
      getAssetsValueByAddress(
        'clients.[name=client-3].connections.[connection_name=connection-1].display_name',
        mockAssetTree
      )
    ).to.equal('My connection display name');
    expect(getAssetsValueByAddress('this.address.should.not.exist', mockAssetTree)).to.equal(
      undefined
    );
    expect(getAssetsValueByAddress('this.address.[should=not].exist', mockAssetTree)).to.equal(
      undefined
    );
    expect(getAssetsValueByAddress('this.address.should.[not=exist]', mockAssetTree)).to.equal(
      undefined
    );
  });
});

describe('convertAddressToDotNotation', () => {
  const mockAssets = {
    tenant: {
      friendly_name: 'Friendly Tenant Name',
    },
    actions: [
      {
        name: 'action-1',
        code: "window.alert('Foo')",
      },
      {
        name: 'action-2',
        nestedProperty: {
          array: [
            {
              name: 'foo',
            },
            {
              name: 'bar',
              arrayProperty: 'baz',
            },
          ],
        },
      },
    ],
  };

  it('should convert proprietary address to conventional JS object notation (aka "dot notation")', () => {
    expect(convertAddressToDotNotation(mockAssets, 'tenant.friendly_name')).to.equal(
      'tenant.friendly_name'
    );
    expect(getDotNotation(mockAssets, 'tenant.friendly_name')).to.equal(
      mockAssets.tenant.friendly_name
    );

    expect(convertAddressToDotNotation(mockAssets, 'actions.[name=action-1].code')).to.equal(
      'actions.0.code'
    );
    expect(getDotNotation(mockAssets, 'actions.0.code')).to.equal(mockAssets.actions[0].code);

    expect(
      convertAddressToDotNotation(
        mockAssets,
        'actions.[name=action-2].nestedProperty.array.[name=bar].arrayProperty'
      )
    ).to.equal('actions.1.nestedProperty.array.1.arrayProperty');

    expect(getDotNotation(mockAssets, 'actions.1.nestedProperty.array.1.arrayProperty')).to.equal(
      mockAssets.actions[1].nestedProperty?.array[1].arrayProperty
    );
  });

  it('should throw if provided address is invalid', () => {
    expect(() =>
      convertAddressToDotNotation(mockAssets, 'actions.[name=this-action-does-not-exist].code')
    ).to.throw(
      `Cannot find [name=this-action-does-not-exist] in [{"name":"action-1","code":"window.alert('Foo')"},{"name":"action-2","nestedProperty":{"array":[{"name":"foo"},{"name":"bar","arrayProperty":"baz"}]}}]`
    );
  });
});

describe('updateAssetsByAddress', () => {
  const mockAssetTree = {
    tenant: {
      display_name: 'This is my tenant display name',
    },
    clients: [
      {
        name: 'client-1',
        display_name: 'Some Display Name',
      },
      {
        name: 'client-2',
        display_name: 'This is the target value',
      },
      {
        name: 'client-3',
        connections: [
          {
            connection_name: 'connection-1',
            display_name: 'My connection display name',
          },
        ],
      },
    ],
  };
  it('should update an specific asset field for a provided address', () => {
    expect(
      updateAssetsByAddress(
        mockAssetTree,
        'clients.[name=client-3].connections.[connection_name=connection-1].display_name',
        'New connection display name'
      )
    ).to.deep.equal(
      (() => {
        const newAssets = mockAssetTree;
        //@ts-ignore because we know this value is defined
        newAssets.clients[2].connections[0].display_name = 'New connection display name';
        return newAssets;
      })()
    );

    expect(
      updateAssetsByAddress(mockAssetTree, 'tenant.display_name', 'This is the new display name')
    ).to.deep.equal(
      (() => {
        const newAssets = mockAssetTree;
        newAssets.tenant.display_name = 'This is the new display name';
        return newAssets;
      })()
    );
  });

  it('should throw errors if invalid addresses provided', () => {
    expect(() =>
      updateAssetsByAddress(mockAssetTree, 'clients.[name=this-client-does-not-exist]', '_')
    ).to.throw();

    expect(() =>
      updateAssetsByAddress(mockAssetTree, 'tenant.this_property_does_not_exist', '_')
    ).to.throw(
      'cannot update assets by address: tenant.this_property_does_not_exist because it does not exist.'
    );
  });
});

describe('preserveKeywords', () => {
  const mockLocalAssets = {
    tenant: {
      display_name: 'The ##COMPANY_NAME## Tenant',
      allowed_logout_urls: '@@ALLOWED_LOGOUT_URLS@@',
    },
    actions: [
      {
        name: 'action-1',
        display_name: '##ENV## Action 1',
      },
      {
        name: 'action-2',
        display_name: "This action won't exist on remote, will be deleted",
      },
    ],
  };

  const mockRemoteAssets = {
    tenant: {
      display_name: 'The Travel0 Tenant',
      allowed_logout_urls: ['localhost:3000/logout', 'https://travel0.com/logout'],
    },
    prompts: {
      universal_login_enabled: true,
      customText: {},
    },
    pages: undefined, //TODO: test these cases more thoroughly
    rules: null, //TODO: test these cases more thoroughly
    actions: [
      {
        name: 'action-1',
        display_name: 'Production Action 1',
      },
      {
        name: 'action-3',
        display_name: 'This action exists on remote but not local',
      },
    ],
  };

  it('should preserve keywords when they correlate to keyword mappings', () => {
    const preservedAssets = preserveKeywords(mockLocalAssets, mockRemoteAssets, {
      COMPANY_NAME: 'Travel0',
      ALLOWED_LOGOUT_URLS: ['localhost:3000/logout', 'https://travel0.com/logout'],
      ENV: 'Production',
    });

    expect(preservedAssets).to.deep.equal(
      (() => {
        const expected = cloneDeep(mockRemoteAssets);
        //@ts-ignore
        expected.tenant = mockLocalAssets.tenant;
        expected.actions[0].display_name = '##ENV## Action 1';
        return expected;
      })()
    );
  });

  it('should not preserve keywords when no keyword mappings', () => {
    const preservedAssets = preserveKeywords(mockLocalAssets, mockRemoteAssets, {});
    expect(preservedAssets).to.deep.equal(mockRemoteAssets);
  });
});
