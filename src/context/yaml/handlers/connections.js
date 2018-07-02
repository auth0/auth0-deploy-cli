import { unifyScripts } from 'auth0-source-control-extension-tools/src';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      strategy: { type: 'string' },
      options: { type: 'object' }
    },
    enabled_clients: { type: 'array', items: { type: 'string' } },
    realms: { type: 'array', items: { type: 'string' } },
    metadata: { type: 'object' }
  },
  require: [ 'name', 'strategy' ]
};


export function parse(config) {
  const connections = config.map(connection => ({
    name: connection.name,
    configFile: JSON.stringify(connection)
  }));

  return {
    connections: unifyScripts(connections, {})
  };
}
