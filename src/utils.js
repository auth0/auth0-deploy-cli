import fs from 'fs';
import path from 'path';
import { logger } from 'src/logger';

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
      .filter(f => isFile(f));
    return files.reduce((map, fileName) => {
      const { name } = path.parse(fileName);
      map[name] = map[name] || [];
      map[name].push(path.join(folder, fileName));
      return map;
    }, {});
  } catch (err) {
    return {};
  }
}


export function keywordReplace(input, mappings) {
  // Use this approach for string replacement vs es6 literals
  // as using that might cause issues with rules which are in JS
  let updated = input;

  if (mappings && Object.keys(mappings).length > 0) {
    Object.keys(mappings)
      .forEach((key) => {
        const re = new RegExp(`##${key}##`, 'g');
        updated = updated.replace(re, mappings[key]);
      });

    Object.keys(mappings)
      .forEach((key) => {
        const re = new RegExp(`@@${key}@@`, 'g');
        updated = updated.replace(re, JSON.stringify(mappings[key]));
      });
  }
  return updated;
}


export function loadFile(file, mappings) {
  const f = path.resolve(file);
  try {
    fs.accessSync(f, fs.F_OK);
    return keywordReplace(fs.readFileSync(f, 'utf8'), mappings);
  } catch (error) {
    throw new Error(`Unable to load file ${f} due to ${error}`);
  }
}


export function parseFileGroup(name, files, mappings) {
  const item = { name };

  files.forEach((file) => {
    const content = loadFile(file, mappings);
    const { ext } = path.parse(file);
    if (ext === '.json') {
      item.configFile = content;
    } else {
      logger.warn('Skipping non-metadata file: ' + file);
    }
  });

  return item;
}
