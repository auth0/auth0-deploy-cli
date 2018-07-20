import path from 'path';
import { loadFile } from 'auth0-source-control-extension-tools';


export default function parse(context) {
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
            [name]: loadFile(path.join(context.basePath, script), context.mappings)
          }), {})
        }
      }))
    ]
  };
}
