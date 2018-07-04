import { unifyScripts } from 'auth0-source-control-extension-tools';
import { loadFile } from 'src/utils';

const supportedPages = [ 'login', 'password_reset', 'guardian_multifactor', 'error_page' ];

const pageSchema = {
  type: 'object',
  properties: {
    html: {
      type: 'string',
      default: ''
    },
    enabled: {
      type: 'boolean',
      default: true
    }
  },
  require: [ 'html' ]
};

export const schema = {
  type: 'object',
  properties: {
    ...supportedPages.reduce((o, page) => ({ ...o, [page]: { ...pageSchema } }), {})
  }
};

function pageConfig(name, config, mappings) {
  const page = config[name];
  if (page) {
    return {
      name,
      metadata: true,
      metadataFile: JSON.stringify({ enabled: page.enabled }),
      htmlFile: loadFile(page.html, mappings)
    };
  }
  return null;
}


export function parse(config, mappings) {
  const pages = supportedPages.map(name => pageConfig(name, config, mappings)).filter(p => p);
  return {
    pages: unifyScripts(pages, {})
  };
}
