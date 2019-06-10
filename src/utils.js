import fs from 'fs-extra';
import path from 'path';
import sanitizeName from 'sanitize-filename';
import { loadFile } from 'auth0-source-control-extension-tools';
import dotProp from 'dot-prop';

export function isDirectory(f) {
  try {
    return fs.statSync(path.resolve(f))
      .isDirectory();
  } catch (err) {
    return false;
  }
}

export function isFile(f) {
  try {
    return fs.statSync(path.resolve(f))
      .isFile();
  } catch (err) {
    return false;
  }
}

export function getFiles(folder, exts) {
  if (isDirectory(folder)) {
    return fs.readdirSync(folder)
      .map(f => path.join(folder, f))
      .filter(f => isFile(f) && exts.includes(path.extname(f)));
  }
  return [];
}

export function loadJSON(file, mappings) {
  try {
    const content = loadFile(file, mappings);
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Error parsing JSON from metadata file: ${file}, because: ${e.message}`);
  }
}


export function existsMustBeDir(folder) {
  if (fs.existsSync(folder)) {
    if (!isDirectory(folder)) {
      throw new Error(`Expected ${folder} to be a folder but got a file?`);
    }
    return true;
  }
  return false;
}

export function toConfigFn(data) {
  return key => data[key];
}


export function stripIdentifiers(auth0, assets) {
  const updated = { ...assets };

  // Some of the object identifiers are required to preform updates.
  // Don't strip these object id's
  const ignore = [
    'rulesConfigs',
    'emailTemplates',
    'guardianFactors',
    'guardianFactorProviders',
    'guardianFactorTemplates'
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


export function sanitize(str) {
  return sanitizeName(str, { replacement: '-' });
}


export function hoursAsInteger(property, hours) {
  if (Number.isInteger(hours)) return { [property]: hours };
  return { [`${property}_in_minutes`]: Math.round(hours * 60) };
}


export function formatResults(item) {
  const importantFields = {
    name: null,
    client_id: null,
    audience: null,
    template: null,
    identifier: null,
    strategy: null,
    script: null,
    stage: null,
    id: null
  };
  const result = { ...importantFields };

  Object.entries(item).sort().forEach(([ key, value ]) => {
    result[key] = value;
  });

  Object.keys(importantFields).forEach((key) => {
    if (result[key] === null) delete result[key];
  });

  return result;
}


export function recordsSorter(a, b) {
  const importantFields = [
    'name',
    'key',
    'client_id',
    'template'
  ];

  for (let i = 0; i < importantFields.length; i += 1) {
    const key = importantFields[i];

    if (a[key] && b[key]) {
      return a[key] > b[key] ? 1 : -1;
    }
  }

  return 0;
}


export function clearTenantFlags(tenant) {
  if (tenant.flags && !Object.keys(tenant.flags).length) {
    delete tenant.flags;
  }
}


export function ensureProp(obj, props, value = '') {
  if (!dotProp.has(obj, props)) {
    dotProp.set(obj, props, value);
  }
}
