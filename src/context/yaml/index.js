import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { keywordReplace } from 'auth0-source-control-extension-tools';

import log from '../../logger';
import handlers from '../../context/yaml/handlers';

export default class {
  constructor(config, mappings, basePath) {
    this.config = config;
    this.mappings = mappings;
    this.assets = {};
    if (basePath) {
      this.basePath = basePath;
    } else {
      this.basePath = (typeof config === 'object') ? process.cwd() : path.dirname(config);
    }
  }

  async load() {
    // Allow to send object/json directly
    if (typeof this.config === 'object') {
      this.assets = this.config;
    } else {
      try {
        const fPath = path.resolve(this.config);
        log.debug(`Loading YAML from ${fPath}`);
        this.assets = yaml.safeLoad(keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings));
      } catch (e) {
        log.error(e.stack);
        throw new Error(`Problem loading ${this.configFile}\n${e}`);
      }
    }

    // Allow handlers to process the assets such as loading files etc
    await Promise.all(Object.entries(handlers).map(async ([ name, handler ]) => {
      try {
        const parsed = await handler.parse(this);
        Object.entries(parsed)
          .forEach(([ k, v ]) => {
            this.assets[k] = v;
          });
      } catch (err) {
        throw new Error(`Problem deploying ${name} due to ${err}`);
      }
    }));
  }

  async dump(mgmtClient) {
    await Promise.all(Object.entries(handlers).map(async ([ name, handler ]) => {
      try {
        const dumped = await handler.dump(mgmtClient, this);
        if (dumped) {
          log.info(`Dumping ${name}`);
          Object.entries(dumped)
            .forEach(([ k, v ]) => {
              this.assets[k] = v;
            });
        }
      } catch (err) {
        throw new Error(`Problem dumping ${name} due to ${err}`);
      }
    }));

    // Write YAML File
    const raw = yaml.dump(this.assets);
    log.info(`Writing ${this.config}`);
    fs.writeFileSync(this.config, raw);
  }
}
