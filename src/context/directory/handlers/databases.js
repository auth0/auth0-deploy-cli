import path from 'path';
import fs from 'fs-extra';
import { constants, loadFile } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import {
  isDirectory,
  existsMustBeDir,
  dumpJSON,
  loadJSON,
  getFiles,
  sanitize,
  mapClientID2NameSorted
} from '../../../utils';


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
      // customScripts option only written if there are scripts
      ...(metaData.customScripts && {
        customScripts: metaData.customScripts
      })
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
  if (!existsMustBeDir(databaseFolder)) return { databases: undefined }; // Skip

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
    const dbFolder = path.join(databasesFolder, sanitize(database.name));
    fs.ensureDirSync(dbFolder);

    const sortCustomScripts = ([ name1 ], [ name2 ]) => {
      if (name1 === name2) return 0;
      return name1 > name2 ? 1 : -1;
    };

    const formatted = {
      ...database,
      ...(database.enabled_clients && { enabled_clients: mapClientID2NameSorted(database.enabled_clients, context.assets.clientsOrig) }),
      options: {
        ...database.options,
        // customScripts option only written if there are scripts
        ...(database.options.customScripts && {
          customScripts: Object.entries(database.options.customScripts).sort(sortCustomScripts).reduce((scripts, [ name, script ]) => {
            // Dump custom script to file
            const scriptName = sanitize(`${name}.js`);
            const scriptFile = path.join(dbFolder, scriptName);
            log.info(`Writing ${scriptFile}`);
            fs.writeFileSync(scriptFile, script);
            scripts[name] = `./${scriptName}`;
            return scripts;
          }, {})
        })
      }
    };

    const databaseFile = path.join(dbFolder, 'database.json');
    dumpJSON(databaseFile, formatted);
  });
}


export default {
  parse,
  dump
};
