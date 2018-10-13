import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { loadFile, keywordReplace, Auth0 } from 'auth0-source-control-extension-tools';

import log from '../../logger';
import { isFile } from '../../utils';
import handlers from './handlers';

export default class {
  constructor(config, mappings, basePath, mgmtClient) {
    this.config = config;
    this.mappings = mappings;
    this.assets = {};
    this.mockMgmtClient = mgmtClient;
    if (basePath) {
      this.basePath = basePath;
    } else {
      this.basePath = (typeof config === 'object') ? process.cwd() : path.dirname(config);
    }
  }

  loadFile(f) {
    let toLoad = path.join(this.basePath, f);
    if (!isFile(toLoad)) {
      // try load not relative to yaml file
      toLoad = f;
    }
    return loadFile(toLoad, this.mappings);
  }

  async load() {
    // Allow to send object/json directly
    if (typeof this.config === 'object') {
      this.assets = this.config;
    } else {
      try {
        const fPath = path.resolve(this.config);
        log.debug(`Loading YAML from ${fPath}`);
        this.assets = yaml.safeLoad(keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings)) || {};
      } catch (err) {
        log.error(err.stack);
        throw new Error(`Problem loading ${this.configFile}\n${err}`);
      }
    }

    // Run initial schema check to ensure valid YAML
    const auth0 = new Auth0(this.mockMgmtClient, this.assets, this.config);
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
        log.error(err.stack);
        throw new Error(`Problem deploying ${name}`);
      }
    }));
  }

  async dump() {
    await Promise.all(Object.entries(handlers).map(async ([ name, handler ]) => {
      try {
        const dumped = await handler.dump(this.mockMgmtClient, this);
        if (dumped) {
          log.info(`Dumping ${name}`);
          Object.entries(dumped)
            .forEach(([ k, v ]) => {
              this.assets[k] = v;
            });
        }
      } catch (err) {
        log.error(err.stack);
        throw new Error(`Problem dumping ${name}`);
      }
    }));

    // Write YAML File
    const raw = yaml.dump(this.assets);
    log.info(`Writing ${this.config}`);
    fs.writeFileSync(this.config, raw);
  }
}
