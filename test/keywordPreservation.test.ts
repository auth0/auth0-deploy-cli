import { expect } from 'chai';
import {
  shouldFieldBePreserved,
  getPreservableFieldsFromAssets,
  getAssetsValueByAddress,
} from '../src/keywordPreservation';

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
        '',
        {
          KEYWORD: 'Travel0',
          ARRAY_REPLACE_KEYWORD: ['this value', 'that value'],
        }
      );

      expect(fieldsToPreserve).to.have.members([
        '.object.friendly_name',
        '.object.nested.nestedProperty',
        '.array.[name=array-item-1].nestedArray.[name=nested-array-item-1].value',
        '.array.[name=array-item-1].nestedArray.[name=nested-array-item-2].value',
        '.array.[name=array-item-1].nested.nestedProperty',
        '.arrayReplace',
      ]);
    });
  });
});

describe('getAssetsValueByAddress', () => {
  it('should find address with proprietary notation', () => {
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
  });
});
