import { expect } from 'chai';
import { findUnreplacedKeywords } from '../../src/commands/import';

describe('#findUnreplacedKeywords function', () => {
  it('should not throw if no unreplaced keywords', () => {
    const fn = () =>
      findUnreplacedKeywords({
        actions: [
          {
            foo: 'foo',
            bar: 'bar',
          },
          {
            foo: ['foo1', 'foo2'],
            bar: 'bar',
          },
          {
            foo: 'foo',
            bar: 'bar',
          },
        ],
        tenant: {
          foo: 'foo',
          bar: {
            some: {
              nested: { property: 'bar baz' },
            },
          },
        },
        //@ts-ignore because we're detecting this
        databases: '     database value     ', //
      });

    expect(fn).to.not.throw();
  });
  it('should throw if unreplaced keywords detected', () => {
    const fn = () =>
      findUnreplacedKeywords({
        actions: [
          {
            foo: 'foo',
            bar: 'bar',
          },
          {
            foo: ['##KEYWORD1##', '##KEYWORD2##'],
            bar: 'bar',
          },
          {
            foo: 'foo',
            bar: 'bar',
          },
        ],
        tenant: {
          foo: 'foo',
          bar: {
            some: {
              nested: { property: 'bar ##KEYWORD3##' },
            },
          },
        },
        //@ts-ignore because we're detecting this
        databases: '     @@KEYWORD4@@     ', //
      });

    expect(fn).to.throw(
      'Unreplaced keywords found: KEYWORD1, KEYWORD2, KEYWORD3, KEYWORD4. Either correct these values or add to AUTH0_KEYWORD_REPLACE_MAPPINGS configuration.'
    );
  });
});
