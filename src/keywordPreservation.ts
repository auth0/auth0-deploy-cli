import { get as getByDotNotation, set as setByDotNotation } from 'dot-prop';
import { keywordReplace } from './tools/utils';
import { KeywordMappings } from './types';
import { keywordReplaceArrayRegExp, keywordReplaceStringRegExp } from './tools/utils';
import { cloneDeep } from 'lodash';

/*
  RFC for Keyword Preservation: https://github.com/auth0/auth0-deploy-cli/issues/688
  Original Github Issue: https://github.com/auth0/auth0-deploy-cli/issues/328
*/

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
  asset: object,
  keywordMappings: KeywordMappings,
  address = ''
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
        // Using the `name` field as the primary unique identifier for array items
        // TODO: expand the available identifier fields to encompass objects that lack name
        const hasIdentifier = arrayItem.name !== undefined;

        if (!hasIdentifier) return [];

        return getPreservableFieldsFromAssets(
          arrayItem,
          keywordMappings,
          `${address}${shouldRenderDot ? '.' : ''}[name=${arrayItem.name}]`
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
          keywordMappings,
          `${address}${shouldRenderDot ? '.' : ''}${key}`
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

// convertAddressToDotNotation will convert the proprietary address into conventional
// JS object notation. Performing this conversion simplifies the process
// of updating a specific property for a given asset tree using the dot-prop library
// returns null if address value does not exist in asset tree
export const convertAddressToDotNotation = (
  assets: any,
  address: string,
  finalAddressTrail = ''
): string | null => {
  const directions = address.split('.');

  if (directions[0] === '') return finalAddressTrail;

  if (directions[0].charAt(0) === '[') {
    const identifier = directions[0].substring(1, directions[0].length - 1).split('=')[0];
    const identifierValue = directions[0].substring(1, directions[0].length - 1).split('=')[1];

    let targetIndex = -1;

    assets.forEach((item: any, index: number) => {
      if (item[identifier] === identifierValue) {
        targetIndex = index;
      }
    });

    if (targetIndex === -1) return null; // No object of this address exists in the assets

    return convertAddressToDotNotation(
      assets[targetIndex],
      directions.slice(1).join('.'),
      `${finalAddressTrail}.${targetIndex}`
    );
  }

  return convertAddressToDotNotation(
    getByDotNotation(assets, directions[0]),
    directions.slice(1).join('.'),
    finalAddressTrail === '' ? directions[0] : `${finalAddressTrail}.${directions[0]}`
  );
};

export const updateAssetsByAddress = (
  assets: object,
  address: string,
  newValue: string
): object => {
  const dotNotationAddress = convertAddressToDotNotation(assets, address);

  if (dotNotationAddress === null) return assets;

  const doesPropertyExist = getByDotNotation(assets, dotNotationAddress) !== undefined;

  if (!doesPropertyExist) {
    return assets;
  }

  setByDotNotation(assets, dotNotationAddress, newValue);
  return assets;
};

// preserveKeywords is the function that ultimately gets executed during export
// to attempt to preserve keywords (ex: ##KEYWORD##) in local configuration files
// from getting overwritten by remote values during export.
export const preserveKeywords = (
  localAssets: object,
  remoteAssets: object,
  keywordMappings: KeywordMappings
): object => {
  if (Object.keys(keywordMappings).length === 0) return remoteAssets;

  const addresses = getPreservableFieldsFromAssets(localAssets, keywordMappings, '');

  let updatedRemoteAssets = cloneDeep(remoteAssets);

  addresses.forEach((address) => {
    const localValue = getAssetsValueByAddress(address, localAssets);
    const remoteValue = getAssetsValueByAddress(address, remoteAssets);

    const localValueWithReplacement = keywordReplace(localValue, keywordMappings);

    const localAndRemoteValuesAreEqual = (() => {
      if (typeof remoteValue === 'string') {
        return localValueWithReplacement === remoteValue;
      }
      //TODO: Account for non-string replacements via @@ syntax
    })();

    if (!localAndRemoteValuesAreEqual) {
      console.warn(
        `WARNING! The remote value with address of ${address} has value of "${remoteValue}" but will be preserved with "${localValueWithReplacement}" due to keyword preservation.`
      );
    }

    updatedRemoteAssets = updateAssetsByAddress(updatedRemoteAssets, address, localValue);
  });

  return updatedRemoteAssets;
};
