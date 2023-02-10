import { expect } from 'chai';
import { shouldFieldBePreserved, getPreservableFieldsFromAssets } from '../src/keywordPreservation';

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
              nestedArray: ['Nested array value 1 ##KEYWORD##', 'Nested array value 2 ##KEYWORD##'],
              notInKeywordMapping: '##NOT_IN_KEYWORD_MAPPING##',
              nested: {
                nestedProperty: 'Another nested array property ##KEYWORD##',
              },
            },
          ],
        },
        {
          KEYWORD: 'Travel0',
        }
      );

      expect(fieldsToPreserve).to.have.members([
        'Friendly name ##KEYWORD##',
        'Nested property ##KEYWORD##',
        'Nested array value 1 ##KEYWORD##',
        'Nested array value 2 ##KEYWORD##',
        'Another nested array property ##KEYWORD##',
      ]);
    });
  });
});
