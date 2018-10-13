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
          customScripts: Object.entries(database.options.customScripts || {}).reduce((scripts, [ name, script ]) => ({
            ...scripts,
            [name]: context.loadFile(script)
          }), {})
        }
      }))
    ]
  };
}

async function dump(mgmtClient, context) {
  let databases = await mgmtClient.connections.getAll({ strategy: 'auth0', paginate: true }) || [];

  const hasCustomScripts = databases.some(d => d.options && d.options.customScripts);

  if (hasCustomScripts) {
    // Create Scripts
    databases = databases.map((db) => {
      const updated = { ...db };
      if (db.options && db.options.customScripts) {
        // Create Database folder
        const dbFolder = path.join(context.basePath, 'databases', db.name);
        fs.ensureDirSync(dbFolder);

        // Dump custom scripts to file
        updated.options.customScripts = Object.entries(updated.options.customScripts).reduce((scripts, [ name, script ]) => {
          const scriptFile = path.join(dbFolder, `${name}.js`);
          log.info(`Writing ${scriptFile}`);
          fs.writeFileSync(scriptFile, script);
          scripts[name] = scriptFile;
          return scripts;
        }, {});
      }
      return updated;
    });
  }

  return { databases };
}


export default {
  parse,
  dump
};
