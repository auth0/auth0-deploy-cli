import path from 'path';
import fs from 'fs-extra';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { isDirectory, existsMustBeDir, loadJSON, getFiles } from '../../../utils';


function getDatabase(folder, mappings) {
  const metaFile = path.join(folder, 'database.json');
  let metaData = {};

  // First load database.json
  try {
    metaData = loadJSON(metaFile, mappings);
  } catch (err) {
    log.warn(`Skipping database folder ${folder} as cannot find or read ${metaFile}`);
    return {};
  }

  if (!metaData) {
    log.warn(`Skipping database folder ${folder} as ${metaFile} is empty`);
    return {};
  }

  const database = {
    ...metaData,
    options: {
      ...metaData.options,
      customScripts: metaData.customScripts || {}
    }
  };

  getFiles(folder, [ '.js' ]).forEach((file) => {
    const { name } = path.parse(file);
    if (!constants.DATABASE_SCRIPTS.includes(name)) {
      log.warn('Skipping invalid database script file: ' + file);
    } else {
      database.options.customScripts[name] = loadFile(file, mappings);
    }
  });

  return database;
}

function parse(context) {
  const databaseFolder = path.join(context.filePath, constants.DATABASE_CONNECTIONS_DIRECTORY);
  if (!existsMustBeDir(databaseFolder)) return { databases: [] }; // Skip

  const folders = fs.readdirSync(databaseFolder)
    .map(f => path.join(databaseFolder, f))
    .filter(f => isDirectory(f));

  const databases = folders.map(f => getDatabase(f, context.mappings))
    .filter(p => Object.keys(p).length > 1);

  return {
    databases
  };
}

async function dump(context) {
  const { databases } = context.assets;

  if (!databases) return; // Skip, nothing to dump

  const databasesFolder = path.join(context.filePath, constants.DATABASE_CONNECTIONS_DIRECTORY);
  fs.ensureDirSync(databasesFolder);

  databases.forEach((database) => {
    const formatted = {
      ...database,
      options: {
        ...database.options,
        customScripts: Object.entries(database.options.customScripts || {}).reduce((scripts, [ name, script ]) => {
          // Create Database folder
          const dbFolder = path.join(context.filePath, constants.DATABASE_CONNECTIONS_DIRECTORY, database.name);
          fs.ensureDirSync(dbFolder);

          // Dump custom script to file
          const scriptFile = path.join(dbFolder, `${name}.js`);
          log.info(`Writing ${scriptFile}`);
          fs.writeFileSync(scriptFile, script);
          scripts[name] = `./${name}.js`;
          return scripts;
        }, {})
      }
    };

    const databaseFile = path.join(databasesFolder, database.name, 'database.json');
    log.info(`Writing ${databaseFile}`);
    fs.writeFileSync(databaseFile, JSON.stringify(formatted, null, 2));
  });
}


export default {
  parse,
  dump
};
