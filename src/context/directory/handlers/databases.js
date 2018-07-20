import path from 'path';
import fs from 'fs';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import { logger } from '../../../logger';
import { isDirectory, isFile, existsMustBeDir } from '../../../utils';


function isScript(name) {
  return constants.DATABASE_SCRIPTS.includes(name);
}

function getDatabase(folder, mappings) {
  const database = { name: path.basename(folder), customScripts: {} };

  const files = fs.readdirSync(folder)
    .map(f => path.join(folder, f))
    .filter(f => isFile(f));

  files.forEach((file) => {
    const { name: script, ext } = path.parse(file);

    if (!isScript(script) || ext !== '.js') {
      logger.warn('Skipping file that is not a script: ' + file);
      return;
    }

    const content = loadFile(file, mappings);
    database.customScripts[script] = content;
  });

  return database;
}

export default function parse(folder, mappings) {
  const databaseFolder = path.join(folder, constants.DATABASE_CONNECTIONS_DIRECTORY);

  existsMustBeDir(databaseFolder);

  let folders = [];

  try {
    folders = fs.readdirSync(databaseFolder)
      .map(f => path.join(databaseFolder, f))
      .filter(f => isDirectory(f));
  } catch (err) {
    return {};
  }

  const databases = folders.map(f => getDatabase(f, mappings))
    .filter(p => Object.keys(p).length > 1);

  return {
    databases
  };
}
