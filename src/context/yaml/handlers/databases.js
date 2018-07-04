import { loadFile } from 'src/utils';
import { constants } from 'auth0-source-control-extension-tools';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      scripts: {
        type: 'object',
        properties: {
          ...constants.DATABASE_SCRIPTS.reduce((o, script) => ({ ...o, [script]: { type: 'string' } }), {})
        },
        require: [ 'login', 'get_user' ]
      }
    },
    require: [ 'name', 'scripts', 'import_mode' ]
  }
};


function formatScripts(scripts, mappings) {
  return Object.entries(scripts).reduce((o, [ name, file ]) => ({
    ...o,
    [name]: {
      scriptFile: loadFile(file, mappings)
    }
  }), {});
}

export function parse(config, mappings) {
  return {
    databases: config.map(database => ({
      ...database,
      scripts: formatScripts(database.scripts, mappings)
    }))
  };
}
