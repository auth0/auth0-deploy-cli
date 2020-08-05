import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { loadFile, keywordReplace, Auth0 } from 'auth0-source-control-extension-tools';

import log from '../../logger';
import { isFile, toConfigFn, stripIdentifiers, formatResults, recordsSorter } from '../../utils';
import handlers from './handlers';
import cleanAssets from '../../readonly';

export default class {
  constructor(config, mgmtClient) {
    this.configFile = config.AUTH0_INPUT_FILE;
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

    this.basePath = config.AUTH0_BASE_PATH;
    if (!this.basePath) {
      this.basePath = (typeof configFile === 'object') ? process.cwd() : path.dirname(this.configFile);
    }
  }

  loadFile(f) {
    let toLoad = path.join(this.basePath, f);
    if (!isFile(toLoad)) {
      // try load not relative to yaml file
      toLoad = f;
    }
    return loadFile(path.resolve(toLoad), this.mappings);
  }

  async load() {
    // Allow to send object/json directly
    if (typeof this.configFile === 'object') {
      this.assets = this.configFile;
    } else {
      try {
        const fPath = path.resolve(this.configFile);
        log.debug(`Loading YAML from ${fPath}`);
        Object.assign(this.assets, yaml.safeLoad(keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings)) || {});
      } catch (err) {
        log.debug(err.stack);
        throw new Error(`Problem loading ${this.configFile}\n${err}`);
      }
    }

    // Run initial schema check to ensure valid YAML
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    await auth0.validate('validate');

    // Allow handlers to process the assets such as loading files etc
    await Promise.all(Object.entries(handlers).map(async ([ name, handler ]) => {
      try {
        const parsed = await handler.parse(this);
        Object.entries(parsed)
          .forEach(([ k, v ]) => {
            this.assets[k] = v;
          });
      } catch (err) {
        log.debug(err.stack);
        throw new Error(`Problem deploying ${name}`);
      }
    }));
  }

  async dump() {
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    log.info('Loading Auth0 Tenant Data');
    try {
      await auth0.loadAll();
      this.assets = auth0.assets;
    } catch (err) {
      throw new Error(`Problem loading tenant data from Auth0 ${err}`);
    }

    await Promise.all(Object.entries(handlers).map(async ([ name, handler ]) => {
      try {
        const data = await handler.dump(this);
        if (data) {
          log.info(`Exporting ${name}`);
          Object.entries(data)
            .forEach(([ k, v ]) => {
              this.assets[k] = Array.isArray(v) ? v.map(formatResults).sort(recordsSorter) : formatResults(v);
            });
        }
      } catch (err) {
        log.debug(err.stack);
        throw new Error(`Problem exporting ${name}`);
      }
    }));

    // Clean known read only fields
    let cleaned = cleanAssets(this.assets, this.config);

    // Delete exclude as it's not part of the auth0 tenant config
    delete cleaned.exclude;

    // Optionally Strip identifiers
    if (!this.config.AUTH0_EXPORT_IDENTIFIERS) {
      cleaned = stripIdentifiers(auth0, cleaned);
    }

    // Write YAML File
    const raw = yaml.dump(cleaned);
    log.info(`Writing ${this.configFile}`);
    fs.writeFileSync(this.configFile, raw);
  }
}
