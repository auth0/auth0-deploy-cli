import fs from 'fs-extra';
import path from 'path';

import { sanitize } from '../../../utils';
import log from '../../../logger';


async function parse(context) {
  // Load the script file for custom db
  if (!context.assets.databases) return {};

  return {
    databases: [
      ...context.assets.databases.map(database => ({
        ...database,
        options: {
          ...database.options,
          // customScripts option only written if there are scripts
          ...(database.options.customScripts && {
            customScripts: Object.entries(database.options.customScripts).reduce((scripts, [ name, script ]) => ({
              ...scripts,
              [name]: context.loadFile(script)
            }), {})
          })
        }
      }))
    ]
  };
}

async function dump(context) {
  const { databases } = context.assets;

  // Nothing to do
  if (!databases) return {};

  const sortCustomScripts = ([ name1 ], [ name2 ]) => {
    if (name1 === name2) return 0;
    return name1 > name2 ? 1 : -1;
  };

  const clients = context.assets.clients || [];

  return {
    databases: [
      ...databases.map(database => ({
        ...database,
        // Convert enabled_clients from id to name
        enabled_clients: [
          ...(database.enabled_clients || []).map((clientId) => {
            const found = clients.find(c => c.client_id === clientId);
            if (found) return found.name;
            return clientId;
          })
        ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
        options: {
          ...database.options,
          // customScripts option only written if there are scripts
          ...(database.options.customScripts && {
            customScripts: Object.entries(database.options.customScripts).sort(sortCustomScripts).reduce((scripts, [ name, script ]) => {
              // Create Database folder
              const dbName = sanitize(database.name);
              const dbFolder = path.join(context.basePath, 'databases', sanitize(dbName));
              fs.ensureDirSync(dbFolder);

              // Dump custom script to file
              const scriptName = sanitize(name);
              const scriptFile = path.join(dbFolder, `${scriptName}.js`);
              log.info(`Writing ${scriptFile}`);
              fs.writeFileSync(scriptFile, script);
              scripts[name] = `./databases/${dbName}/${scriptName}.js`;
              return scripts;
            }, {})
          })
        }
      }))
    ]
  };
}


export default {
  parse,
  dump
};
