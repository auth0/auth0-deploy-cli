import fs from 'fs-extra';
import path from 'path';
import { loadFile } from 'auth0-source-control-extension-tools';

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
  const ignore = [ 'rulesConfigs', 'emailTemplates' ];

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
