import fs from 'fs';
import path from 'path';
import { logger } from 'src/logger';
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

export function groupFiles(folder) {
  try {
    const files = fs.readdirSync(folder)
      .map(f => path.join(folder, f))
      .filter(f => isFile(f));
    return files.reduce((map, fileName) => {
      let { name } = path.parse(fileName);

      // check for meta files
      if (name.endsWith('.meta')) name = name.replace('.meta', '');

      map[name] = map[name] || [];
      map[name].push(fileName);
      return map;
    }, {});
  } catch (err) {
    return {};
  }
}


export function loadJSON(file, mappings) {
  try {
    const content = loadFile(file, mappings);
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Error parsing JSON from metadata file: ${file}, because: ${e.message}`);
  }
}


export function parseFileGroup(name, files, mappings) {
  const item = { name };

  files.forEach((file) => {
    const { name: fileName, ext: fileExt } = path.parse(file);
    if (fileExt === '.json' || fileName.endsWith('.meta')) {
      Object.assign(item, loadJSON(file, mappings));
    } else {
      logger.warn('Skipping non-metadata file: ' + file);
    }
  });

  return item;
}


export function existsMustBeDir(folder) {
  if (fs.existsSync(folder)) {
    if (!isDirectory(folder)) {
      throw new Error(`Expected ${folder} to be a folder but got a file?`);
    }
  }
}


export function loadFilesByKey(item, baseDir, keys, mappings) {
  const newItem = { ...item };
  keys.forEach((key) => {
    if (item[key]) {
      newItem[key] = loadFile(path.join(baseDir, item[key]), mappings);
    }
  });
  return newItem;
}
