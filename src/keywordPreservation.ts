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
  if (Array.isArray(asset)) {
    return asset
      .map((arrayItem) => {
        return getPreservableFieldsFromAssets(
          arrayItem,
          `${address}.[name=${arrayItem.name}]`,
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
        return getPreservableFieldsFromAssets(value, `${address}.${key}`, keywordMappings);
      })
      .flat();
  }
  return [];
};

export const getAssetsValueByAddress = (address: string, assets: any): any => {
  const isTrivialAddress = address.indexOf('[') === -1;
  if (isTrivialAddress) {
    return getByDotNotation(assets, address);
  }

  const directions = address.split('.');

  if (directions.length === 0) return assets;

  if (directions[0].charAt(0) === '[') {
    const identifier = directions[0].substring(1, directions[0].length - 1).split('=')[0];
    const identifierValue = directions[0].substring(1, directions[0].length - 1).split('=')[1];

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
