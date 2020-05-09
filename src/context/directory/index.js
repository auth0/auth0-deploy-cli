import * as path from 'path';
import { loadFile, Auth0 } from 'auth0-source-control-extension-tools';

import cleanAssets from '../../readonly';
import log from '../../logger';
import handlers from './handlers';
import { isDirectory, isFile, stripIdentifiers, toConfigFn } from '../../utils';

export default class {
  constructor(config, mgmtClient) {
    this.filePath = config.AUTH0_INPUT_FILE;
    this.config = config;
    this.mappings = config.AUTH0_KEYWORD_REPLACE_MAPPINGS;
    this.mgmtClient = mgmtClient;

    // Get excluded rules
    this.assets = {
      exclude: {
        rules: config.AUTH0_EXCLUDED_RULES || [],
        clients: config.AUTH0_EXCLUDED_CLIENTS || [],
        databases: config.AUTH0_EXCLUDED_DATABASES || [],
        connections: config.AUTH0_EXCLUDED_CONNECTIONS || [],
        resourceServers: config.AUTH0_EXCLUDED_RESOURCE_SERVERS || [],
        defaults: config.AUTH0_EXCLUDED_DEFAULTS || []
      }
    };
  }

  loadFile(f, folder) {
    const basePath = path.join(this.filePath, folder);
    let toLoad = path.join(basePath, f);
    if (!isFile(toLoad)) {
      // try load not relative to yaml file
      toLoad = f;
    }
    return loadFile(toLoad, this.mappings);
  }

  async load() {
    if (isDirectory(this.filePath)) {
      /* If this is a directory, look for each file in the directory */
      log.info(`Processing directory ${this.filePath}`);

      Object.values(handlers)
        .forEach((handler) => {
          const parsed = handler.parse(this);
          Object.entries(parsed)
            .forEach(([ k, v ]) => {
              this.assets[k] = v;
            });
        });
      return;
    }
    throw new Error(`Not sure what to do with, ${this.filePath} as it is not a directory...`);
  }

  async dump() {
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    log.info('Loading Auth0 Tenant Data');
    await auth0.loadAll();
    this.assets = auth0.assets;

    // Clean known read only fields
    this.assets = cleanAssets(this.assets, this.config);

    // Copy clients to be used by handlers which require converting client_id to the name
    // Must copy as the client_id will be stripped if AUTH0_EXPORT_IDENTIFIERS is false
    this.assets.clientsOrig = [ ...this.assets.clients ];

    // Optionally Strip identifiers
    if (!this.config.AUTH0_EXPORT_IDENTIFIERS) {
      this.assets = stripIdentifiers(auth0, this.assets);
    }

    await Promise.all(Object.entries(handlers).map(async ([ name, handler ]) => {
      try {
        const data = await handler.dump(this);
        if (data) {
          log.info(`Exporting ${name}`);
        }
      } catch (err) {
        log.debug(err.stack);
        throw new Error(`Problem exporting ${name}`);
      }
    }));
  }
}
