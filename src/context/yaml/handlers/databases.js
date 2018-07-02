import { loadFile } from 'src/utils';

const supportedScripts = [ 'login', 'create', 'delete', 'change_email', 'get_user' ];

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      scripts: {
        type: 'object',
        properties: {
          ...supportedScripts.reduce((o, script) => ({ ...o, [script]: { type: 'string' } }), {})
        },
        // TODO: add others
        require: [ 'login', 'get_user' ]
      }
    },
    require: [ 'name', 'scripts', 'import_mode' ]
  }
};


function formatScripts(scripts) {
  return Object.entries(scripts).reduce((o, [ name, file ]) => ({
    ...o,
    [name]: {
      scriptFile: loadFile(file, process.env)
    }
  }), {});
}

export function parse(config) {
  return {
    databases: config.map(database => ({
      ...database,
      scripts: formatScripts(database.scripts)
    }))
  };
}
