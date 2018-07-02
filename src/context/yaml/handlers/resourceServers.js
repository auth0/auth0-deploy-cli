import { unifyScripts } from 'auth0-source-control-extension-tools';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      identifier: { type: 'string' },
      signing_alg: { type: 'string', enum: [ 'HS256', 'RS256' ] },
      signing_secret: { type: 'string' },
      allow_offline_access: { type: 'boolean' },
      token_lifetime: { type: 'number' },
      skip_consent_for_verifiable_first_party_clients: { type: 'boolean' },
      verificationLocation: { type: 'string' },
      options: { type: 'object' },
      scopes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' }
          }
        }
      }
    },
    require: [ 'name', 'identifier' ]
  }
};


export function parse(config) {
  const resources = config.map((r) => {
    const resource = {
      ...r,
      scopes: r.scopes.map(s => ({ value: s.name, description: s.description }))
    };
    return {
      configFile: JSON.stringify(resource),
      name: resource.name
    };
  });
  return {
    resourceServers: unifyScripts(resources, {})
  };
}
