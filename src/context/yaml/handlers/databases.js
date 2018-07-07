import path from 'path';
import { loadFile } from 'auth0-source-control-extension-tools';


export default function parse(context) {
  // Load the script file for custom db
  return {
    databases: [
      ...context.assets.databases.map(database => ({
        ...database,
        options: {
          ...database.options,
          customScripts: Object.entries(database.options.customScripts || {}).reduce((scripts, [ name, script ]) => ({
            ...scripts,
            [name]: loadFile(path.join(context.configPath, script), context.mappings)
          }), {})
        }
      }))
    ]
  };
}
