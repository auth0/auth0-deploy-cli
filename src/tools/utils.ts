import path from 'path';
import fs, { constants as fsConstants } from 'fs';
import dotProp from 'dot-prop';
import _ from 'lodash';
import log from '../logger';
import { Asset, Assets, CalculatedChanges, KeywordMappings } from '../types';
import constants from './constants';

export function keywordArrayReplace(input: string, mappings: KeywordMappings): string {
  Object.keys(mappings).forEach(function (key) {
    // Matching against two sets of patterns because a developer may provide their array replacement keyword with or without wrapping quotes. It is not obvious to the developer which to do depending if they're operating in YAML or JSON.
    const pattern = `@@${key}@@`;
    const patternWithQuotes = `"${pattern}"`;

    const regex = new RegExp(`${patternWithQuotes}|${pattern}`, 'g');
    input = input.replace(regex, JSON.stringify(mappings[key]));
  });
  return input;
}

export function keywordStringReplace(input: string, mappings: KeywordMappings): string {
  Object.keys(mappings).forEach(function (key) {
    const regex = new RegExp(`##${key}##`, 'g');
    // @ts-ignore TODO: come back and distinguish strings vs array replacement.
    input = input.replace(regex, mappings[key]);
  });
  return input;
}

export function keywordReplace(input: string, mappings: KeywordMappings): string {
  // Replace keywords with mappings within input.
  if (mappings && Object.keys(mappings).length > 0) {
    input = keywordStringReplace(input, mappings);

    input = keywordArrayReplace(input, mappings);
  }
  return input;
}

export function convertClientNameToId(name: string, clients: Asset[]): string {
  const found = clients.find((c) => c.name === name);
  return (found && found.client_id) || name;
}

export function convertClientNamesToIds(names: string[], clients: Asset[]): string[] {
  const resolvedNames = names.map((name) => ({ name, resolved: false }));
  const result = clients.reduce((acc: string[], client): string[] => {
    if (names.includes(client.name)) {
      const index = resolvedNames.findIndex((item) => item.name === client.name);
      resolvedNames[index].resolved = true;
      return [...acc, client.client_id];
    }
    return [...acc];
  }, []);
  const unresolved = resolvedNames.filter((item) => !item.resolved).map((item) => item.name);
  // @ts-ignore TODO: come back and refactor to use map instead of reduce.
  return [...unresolved, ...result];
}

export function loadFileAndReplaceKeywords(file: string, mappings: KeywordMappings): string {
  // Load file and replace keyword mappings
  const f = path.resolve(file);
  try {
    fs.accessSync(f, fsConstants.F_OK);
    if (mappings) {
      return keywordReplace(fs.readFileSync(f, 'utf8'), mappings);
    }
    return fs.readFileSync(f, 'utf8');
  } catch (error) {
    throw new Error(`Unable to load file ${f} due to ${error}`);
  }
}

export function flatten(list: any[]): any[] {
  // Flatten an multiple arrays to single array
  return list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);
}

export function convertJsonToString(obj: { [key: string]: any }, spacing = 0): string {
  return JSON.stringify(obj, null, spacing);
}

export function stripFields(obj: Asset, fields: string[]): Asset {
  // Strip object fields supporting dot notation (ie: a.deep.field)
  const stripped: string[] = [];

  const newObj = { ...obj };
  fields.forEach((f) => {
    if (dotProp.get(newObj, f) !== undefined) {
      dotProp.delete(newObj, f);
      stripped.push(f);
    }
  });

  if (stripped) {
    const name = ['id', 'client_id', 'template', 'name'].reduce((n, k) => newObj[k] || n, '');
    log.debug(`Stripping "${name}" read-only fields ${JSON.stringify(stripped)}`);
  }
  return newObj;
}

export function getEnabledClients(
  assets: Assets,
  connection: Asset,
  existing: Asset[],
  clients: Asset[]
): string[] {
  // Convert enabled_clients by name to the id
  const excludedClientsByNames = (assets.exclude && assets.exclude.clients) || [];
  const excludedClients = convertClientNamesToIds(excludedClientsByNames, clients);
  const enabledClients = [
    ...convertClientNamesToIds(connection.enabled_clients || [], clients).filter(
      (item) => ![...excludedClientsByNames, ...excludedClients].includes(item)
    ),
  ];
  // If client is excluded and in the existing connection this client is enabled, it should keep enabled
  // If client is excluded and in the existing connection this client is disabled, it should keep disabled
  existing.forEach((conn) => {
    if (conn.name === connection.name) {
      excludedClients.forEach((excludedClient) => {
        if (conn.enabled_clients.includes(excludedClient)) {
          enabledClients.push(excludedClient);
        }
      });
    }
  });
  return enabledClients;
}

export function duplicateItems(arr: Asset[], key: string): Asset[] {
  // Find duplicates objects within array that have the same key value
  const duplicates = arr.reduce(
    (accum: { [key: string]: Asset[] }, obj): { [key: string]: Asset[] } => {
      const keyValue = obj[key];
      if (keyValue) {
        if (!(keyValue in accum)) accum[keyValue] = [];
        accum[keyValue].push(obj);
      }
      return accum;
    },
    {}
  );
  return Object.values(duplicates).filter((g) => g.length > 1);
}

export function filterExcluded(changes: CalculatedChanges, exclude: string[]): CalculatedChanges {
  const { del, update, create, conflicts } = changes;

  if (!exclude.length) {
    return changes;
  }

  const filter = (list: Asset[]) => list.filter((item) => !exclude.includes(item.name));

  return {
    del: filter(del),
    update: filter(update),
    create: filter(create),
    conflicts: filter(conflicts),
  };
}

export function areArraysEquals(x: any[], y: any[]): boolean {
  return _.isEqual(x && x.sort(), y && y.sort());
}

export const obfuscateSensitiveValues = (
  data: Asset | Asset[] | null,
  sensitiveFieldsToObfuscate: string[]
): Asset | Asset[] | null => {
  if (data === null) return data;
  if (Array.isArray(data)) {
    return data.map((asset) => obfuscateSensitiveValues(asset, sensitiveFieldsToObfuscate));
  }

  const newAsset = { ...data };
  sensitiveFieldsToObfuscate.forEach((sensitiveField) => {
    if (dotProp.get(newAsset, sensitiveField) !== undefined) {
      dotProp.set(newAsset, sensitiveField, constants.OBFUSCATED_SECRET_VALUE);
    }
  });

  return newAsset;
};

// The reverse of `obfuscateSensitiveValues()`, preventing an obfuscated value from being passed to the API
export const stripObfuscatedFieldsFromPayload = (
  data: Asset | Asset[] | null,
  obfuscatedFields: string[]
): Asset | Asset[] | null => {
  if (data === null) return data;
  if (Array.isArray(data)) {
    return data.map((asset) => stripObfuscatedFieldsFromPayload(asset, obfuscatedFields));
  }

  const newAsset = { ...data };
  obfuscatedFields.forEach((sensitiveField) => {
    const obfuscatedFieldValue = dotProp.get(newAsset, sensitiveField);
    if (obfuscatedFieldValue === constants.OBFUSCATED_SECRET_VALUE) {
      dotProp.delete(newAsset, sensitiveField);
    }
  });

  return newAsset;
};
