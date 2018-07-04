import { unifyScripts } from 'auth0-source-control-extension-tools';

const clientSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, pattern: '[^<>]+' },
    description: { type: 'string', maxLength: 140 },
    client_secret: { type: 'string' },
    app_type: { type: 'string' },
    logo_uri: { type: 'string' },
    is_first_party: { type: 'boolean' },
    oidc_conformant: { type: 'boolean' },
    callbacks: { type: 'array', items: { type: 'string' } },
    allowed_origins: { type: 'array', items: { type: 'string' } },
    web_origins: { type: 'array', items: { type: 'string' } },
    client_aliases: { type: 'array', items: { type: 'string' } },
    allowed_clients: { type: 'array', items: { type: 'string' } },
    allowed_logout_urls: { type: 'array', items: { type: 'string' } },
    sso: { type: 'boolean' },
    sso_disabled: { type: 'boolean' },
    cross_origin_auth: { type: 'boolean' },
    cross_origin_loc: { type: 'string' },
    custom_login_page_on: { type: 'boolean' },
    custom_login_page: { type: 'string' },
    custom_login_page_preview: { type: 'string' },
    form_template: { type: 'string' },
    addons: { type: 'object' },
    token_endpoint_auth_method: { type: 'string' },
    client_metadata: {}
  },
  // Allow additional param as there are too many to deal with right now. Perhaps Auth0 needs a schema validation endpoint/api?
  additionalProperties: true
};


export const schema = {
  type: 'array',
  items: clientSchema
};


export function parse(config) {
  const clients = config.map(client => ({
    configFile: JSON.stringify(client),
    name: client.name
  }));
  return {
    clients: unifyScripts(clients, {})
  };
}
