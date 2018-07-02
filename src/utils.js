import fs from 'fs';
import path from 'path';

export function isDirectory(f) {
  return fs.statSync(path.resolve(f))
    .isDirectory();
}

export function isFile(f) {
  return fs.statSync(path.resolve(f))
    .isFile();
}

export function groupFiles(folder) {
  const files = fs.readdirSync(folder);

  return files.reduce((map, fileName) => {
    const { name, ext } = path.parse(fileName);
    map[name] = map[name] || [];
    map[name].push({ filePath: fileName, ext });
    return map;
  }, {});
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
