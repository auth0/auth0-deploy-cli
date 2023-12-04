import { get as getByDotNotation, set as setByDotNotation } from 'dot-prop';
import { keywordReplace } from './tools/utils';
import { AssetTypes, KeywordMappings } from './types';
import { keywordReplaceArrayRegExp, keywordReplaceStringRegExp } from './tools/utils';
import { cloneDeep, forEach, isArray } from 'lodash';
import APIHandler from './tools/auth0/handlers/default';

/*
  RFC for Keyword Preservation: https://github.com/auth0/auth0-deploy-cli/issues/688
  Original Github Issue: https://github.com/auth0/auth0-deploy-cli/issues/328
*/

export const doesHaveKeywordMarker = (
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
  resourceSpecificIdentifiers: Partial<Record<AssetTypes, string | string[]>>,
  address = ''
): string[] => {
  if (typeof asset === 'string') {
    if (doesHaveKeywordMarker(asset, keywordMappings)) {
      return [address];
    }
    return [];
  }

  const shouldRenderDot = address !== '';

  if (Array.isArray(asset)) {
    return asset
      .map((arrayItem) => {
        const resourceIdentifiers: string[] = (() => {
          const identifierOrIdentifiers = resourceSpecificIdentifiers[address as AssetTypes];

          if (Array.isArray(identifierOrIdentifiers)) {
            return identifierOrIdentifiers;
          }

          if (identifierOrIdentifiers === undefined) {
            return [];
          }

          return [identifierOrIdentifiers];
        })();

        const specificAddress = resourceIdentifiers.reduce(
          (aggregateAddress, resourceIdentifier) => {
            resourceSpecificIdentifiers[address];
            if (resourceIdentifier === undefined) return ''; // See if this specific resource type has an identifier

            const identifierFieldValue = arrayItem[resourceIdentifier];
            if (identifierFieldValue === undefined) return ''; // See if this specific array item possess the resource-specific identifier

            if (aggregateAddress === '') {
              return `${resourceIdentifier}=${identifierFieldValue}`;
            }

            return `${aggregateAddress}||${resourceIdentifier}=${identifierFieldValue}`;
          },
          ''
        );

        if (specificAddress.length === 0) {
          return [];
        }

        return getPreservableFieldsFromAssets(
          arrayItem,
          keywordMappings,
          resourceSpecificIdentifiers,
          `${address}${shouldRenderDot ? '.' : ''}[${specificAddress}]`
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
          resourceSpecificIdentifiers,
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
  const directions = address.split(/\.(?![^\[]*\])/g);

  // If the the next directions are the proprietary array syntax (ex: `[name=foo]`)
  // then perform lookup against unique array-item property
  if (directions[0].charAt(0) === '[') {
    if (!isArray(assets)) return undefined;

    const target = assets.find((item: any) => {
      const parts = directions[0].substring(1).slice(0, -1).split('||');

      return parts.every((part) => {
        const identifier = part.split('=')[0];
        const identifierValue = part.split('=')[1];

        return item[identifier] === identifierValue;
      });
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
  if (assets === null) return null; //Asset does not exist on remote

  const directions = address.split(/\.(?![^\[]*\])/g);

  if (directions[0] === '') return finalAddressTrail;

  if (directions[0].charAt(0) === '[') {
    const identifiers = directions[0].substring(1).slice(0, -1).split('||');

    let targetIndex = -1;

    assets.forEach((item: any, index: number) => {
      if (
        identifiers.every((part) => {
          const identifier = part.split('=')[0];
          const identifierValue = part.split('=')[1];

          return item[identifier] === identifierValue;
        })
      ) {
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
export const preserveKeywords = ({
  localAssets,
  remoteAssets,
  keywordMappings,
  auth0Handlers,
}: {
  localAssets: object;
  remoteAssets: object;
  keywordMappings: KeywordMappings;
  auth0Handlers: (Pick<APIHandler, 'id' | 'type'> & {
    identifiers: (string | string[])[];
  })[];
}): object => {
  if (Object.keys(keywordMappings).length === 0) return remoteAssets;

  const resourceSpecificIdentifiers: Partial<Record<AssetTypes, string[]>> = auth0Handlers.reduce(
    (acc, handler) => {
      acc[handler.type] = handler.identifiers.flat();
      return acc;
    },
    {}
  );

  const addresses = getPreservableFieldsFromAssets(
    localAssets,
    keywordMappings,
    resourceSpecificIdentifiers,
    ''
  );

  let updatedRemoteAssets = cloneDeep(remoteAssets);

  addresses.forEach((address) => {
    const localValue = getAssetsValueByAddress(address, localAssets);

    const remoteAssetsAddress = (() => {
      const doesAddressHaveKeyword = doesHaveKeywordMarker(address, keywordMappings);
      if (doesAddressHaveKeyword) {
        return keywordReplace(address, keywordMappings);
      }
      return address;
    })();
    const remoteValue = getAssetsValueByAddress(remoteAssetsAddress, remoteAssets);

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

    // Two address possibilities are provided to account for cases when there is a keyword
    // in the resources's identifier field. When the resource identifier's field is preserved
    // on the remote assets tree, it loses its identify, so we'll need to try two addresses:
    // one where the identifier field has a keyword and one where the identifier field has
    // the literal replaced value.
    // Example: `customDomains.[domain=##DOMAIN].domain` and `customDomains.[domain=travel0.com].domain`
    updatedRemoteAssets = updateAssetsByAddress(
      updatedRemoteAssets,
      address, //Two possible addresses need to be passed, one with identifier field keyword replaced and one where it is not replaced. Ex: `customDomains.[domain=##DOMAIN].domain` and `customDomains.[domain=travel0.com].domain`
      localValue
    );
    updatedRemoteAssets = updateAssetsByAddress(
      updatedRemoteAssets,
      remoteAssetsAddress, //Two possible addresses need to be passed, one with identifier field keyword replaced and one where it is not replaced. Ex: `customDomains.[domain=##DOMAIN].domain` and `customDomains.[domain=travel0.com].domain`
      localValue
    );
  });

  return updatedRemoteAssets;
};
