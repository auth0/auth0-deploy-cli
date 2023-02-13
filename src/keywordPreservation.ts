import { KeywordMappings } from './types';
import { keywordReplaceArrayRegExp, keywordReplaceStringRegExp } from './tools/utils';

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
