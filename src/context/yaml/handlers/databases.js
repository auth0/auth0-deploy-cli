import fs from 'fs-extra';
import path from 'path';

import log from '../../../logger';


async function parse(context) {
  // Load the script file for custom db
  const databases = context.assets.databases || [];
  return {
    databases: [
      ...databases.map(database => ({
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
        ],
        options: {
          ...database.options,
          // customScripts option only written if there are scripts
          ...(database.options.customScripts && {
            customScripts: Object.entries(database.options.customScripts).reduce((scripts, [ name, script ]) => {
              // Create Database folder
              const dbFolder = path.join(context.basePath, 'databases', database.name);
              fs.ensureDirSync(dbFolder);

              // Dump custom script to file
              const scriptFile = path.join(dbFolder, `${name}.js`);
              log.info(`Writing ${scriptFile}`);
              fs.writeFileSync(scriptFile, script);
              scripts[name] = `./databases/${database.name}/${name}.js`;
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
