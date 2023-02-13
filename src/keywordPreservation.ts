import { get as getByDotNotation } from 'dot-prop';
import { KeywordMappings } from './types';
import { keywordReplaceArrayRegExp, keywordReplaceStringRegExp } from './tools/utils';
import { add } from 'lodash';

export const shouldFieldBePreserved = (
  string: string,
  keywordMappings: KeywordMappings
): boolean => {
  return !Object.keys(keywordMappings).every((keyword) => {
    const hasArrayMarker = keywordReplaceArrayRegExp(keyword).test(string);
    const hasStringMarker = keywordReplaceStringRegExp(keyword).test(string);

    return !hasArrayMarker && !hasStringMarker;
  });
};

export const getPreservableFieldsFromAssets = (
  asset: any,
  address: string,
  keywordMappings: KeywordMappings
): string[] => {
  if (typeof asset === 'string') {
    if (shouldFieldBePreserved(asset, keywordMappings)) {
      return [address];
    }
    return [];
  }

  const shouldRenderDot = address !== '';

  if (Array.isArray(asset)) {
    return asset
      .map((arrayItem) => {
        return getPreservableFieldsFromAssets(
          arrayItem,
          `${address}${shouldRenderDot ? '.' : ''}[name=${arrayItem.name}]`,
          keywordMappings
        );
      })
      .flat();
  }
  if (typeof asset === 'object') {
    return Object.keys(asset)
      .map((key: string): string[] => {
        const value = asset[key];

        if (value === undefined || value === null) return [];

        return getPreservableFieldsFromAssets(
          value,
          `${address}${shouldRenderDot ? '.' : ''}${key}`,
          keywordMappings
        );
      })
      .flat();
  }
  return [];
};

// getAssetsValueByAddress returns a value for an arbitrary data structure when
// provided an "address" of that value. This address is similar to JS object notation
// with the exception of identifying array items by a unique property instead of order.
// Example:
// Object: `{ actions: [ { name: "action-1", code: "..."}] }`
// Address: `.actions[name=action-1].code`
export const getAssetsValueByAddress = (address: string, assets: any): any => {
  //Look ahead and see if the address path only contains dots (ex: `tenant.friendly_name`)
  //if so the address is trivial and can use the dot-prop package to return the value

  const isTrivialAddress = address.indexOf('[') === -1;
  if (isTrivialAddress) {
    return getByDotNotation(assets, address);
  }

  // It is easier to handle an address piece-by-piece by
  // splitting on the period into separate "directions"
  const directions = address.split('.');

  // If the the next directions are the proprietary array syntax (ex: `[name=foo]`)
  // then perform lookup against unique array-item property
  if (directions[0].charAt(0) === '[') {
    const identifier = directions[0].substring(1, directions[0].length - 1).split('=')[0];
    const identifierValue = directions[0].substring(1, directions[0].length - 1).split('=')[1];

    if (assets === undefined) return undefined;

    const target = assets.find((item: any) => {
      return item[identifier] === identifierValue;
    });

    return getAssetsValueByAddress(directions.slice(1).join('.'), target);
  }

  return getAssetsValueByAddress(
    directions.slice(1).join('.'),
    getByDotNotation(assets, directions[0])
  );
};
