import fs from 'fs-extra';
import path from 'path';
import sanitizeName from 'sanitize-filename';
import dotProp from 'dot-prop';
import { loadFileAndReplaceKeywords, Auth0 } from './tools';
import log from './logger';
import { Asset, Assets, Config, KeywordMappings } from './types';

export function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(path.resolve(filePath)).isDirectory();
  } catch (err) {
    return false;
  }
}

export function isFile(filePath: string): boolean {
  try {
    return fs.statSync(path.resolve(filePath)).isFile();
  } catch (err) {
    return false;
  }
}

export function getFiles(folder: string, exts: string[]): string[] {
  if (isDirectory(folder)) {
    return fs
      .readdirSync(folder)
      .map((f) => path.join(folder, f))
      .filter((f) => isFile(f) && exts.includes(path.extname(f)));
  }
  return [];
}

export function loadJSON(
  file: string,
  opts: { disableKeywordReplacement: boolean; mappings: KeywordMappings } = {
    disableKeywordReplacement: false,
    mappings: {},
  }
): any {
  try {
    const content = loadFileAndReplaceKeywords(file, {
      mappings: opts.mappings,
      disableKeywordReplacement: opts.disableKeywordReplacement,
    });
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Error parsing JSON from metadata file: ${file}, because: ${e.message}`);
  }
}

export function dumpJSON(file: string, mappings: { [key: string]: any }): void {
  try {
    log.info(`Writing ${file}`);
    const jsonBody = JSON.stringify(mappings, null, 2);
    fs.writeFileSync(file, jsonBody.endsWith('\n') ? jsonBody : `${jsonBody}\n`);
  } catch (e) {
    throw new Error(`Error writing JSON to metadata file: ${file}, because: ${e.message}`);
  }
}

export function existsMustBeDir(folder: string): boolean {
  if (fs.existsSync(folder)) {
    if (!isDirectory(folder)) {
      throw new Error(`Expected ${folder} to be a folder but got a file?`);
    }
    return true;
  }
  return false;
}

export function toConfigFn(data: Config): (arg0: keyof Config) => any {
  return (key) => data[key];
}

export function stripIdentifiers(auth0: Auth0, assets: Assets) {
  const updated = { ...assets };

  // Some of the object identifiers are required to perform updates.
  // Don't strip these object id's
  const ignore = [
    'actions',
    'rulesConfigs',
    'emailTemplates',
    'guardianFactors',
    'guardianFactorProviders',
    'guardianFactorTemplates',
  ];

  // Optionally Strip identifiers
  auth0.handlers.forEach((h) => {
    if (ignore.includes(h.type)) return;
    const exist = updated[h.type];
    // All objects with the identifier field is an array. This could change in future.
    if (Array.isArray(exist)) {
      updated[h.type] = exist.map((o) => {
        const newObj = { ...o };
        delete newObj[h.id];
        return newObj;
      });
    }
  });

  return updated;
}

export function sanitize(str: string): string {
  return sanitizeName(str, { replacement: '-' });
}

type ImportantFields = {
  name: string | null;
  client_id: string | null;
  audience: string | null;
  template: string | null;
  identifier: string | null;
  strategy: string | null;
  script: string | null;
  stage: string | null;
  id: string | null;
};

export function formatResults(item: any): Partial<ImportantFields> {
  if (!item || typeof item !== 'object') {
    return item;
  }
  const importantFields: ImportantFields = {
    name: null,
    client_id: null,
    audience: null,
    template: null,
    identifier: null,
    strategy: null,
    script: null,
    stage: null,
    id: null,
  };
  const result = { ...importantFields };

  Object.entries(item)
    .sort()
    .forEach(([key, value]) => {
      result[key] = value;
    });

  Object.keys(importantFields).forEach((key) => {
    if (result[key] === null) delete result[key];
  });

  return result;
}

export function recordsSorter(a: Partial<ImportantFields>, b: Partial<ImportantFields>): number {
  const importantFields = ['name', 'key', 'client_id', 'template'];

  for (let i = 0; i < importantFields.length; i += 1) {
    const key = importantFields[i];

    if (a[key] && b[key]) {
      return a[key] > b[key] ? 1 : -1;
    }
  }

  return 0;
}

export function clearTenantFlags(tenant: Asset): void {
  if (tenant.flags && !Object.keys(tenant.flags).length) {
    delete tenant.flags;
  }
}

export function ensureProp(obj: Asset, props: string): void {
  const value = '';
  if (!dotProp.has(obj, props)) {
    dotProp.set(obj, props, value);
  }
}

export function clearClientArrays(client: Asset): Asset {
  const propsToClear = ['allowed_clients', 'allowed_logout_urls', 'allowed_origins', 'callbacks'];
  //If designated properties are null, set them as empty arrays instead
  Object.keys(client).forEach((prop) => {
    if (propsToClear.indexOf(prop) >= 0 && !client[prop]) {
      //TODO: understand why setting as empty array instead of deleting null prop. Ex: `delete client[prop]`
      client[prop] = [];
    }
  });

  return client;
}

export function convertClientIdToName(clientId: string, knownClients: Asset[] = []): string {
  try {
    const found = knownClients.find((c) => c.client_id === clientId);
    return (found && found.name) || clientId;
  } catch (e) {
    return clientId;
  }
}

export function mapClientID2NameSorted(enabledClients: string[], knownClients: Asset[]): string[] {
  return [
    ...(enabledClients || []).map((clientId) => convertClientIdToName(clientId, knownClients)),
  ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}
