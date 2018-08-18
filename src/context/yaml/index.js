import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { keywordReplace } from 'auth0-source-control-extension-tools';

import { logger } from '../../logger';
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
        logger.debug(`Loading YAML from ${fPath}`);
        this.assets = yaml.safeLoad(keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings));
      } catch (e) {
        logger.error(e.stack);
        throw new Error(`Problem loading ${this.configFile}\n${e}`);
      }
    }

    // Allow handlers to process the assets such as loading files etc
    Object.values(handlers)
      .forEach((handler) => {
        const parsed = handler(this);
        Object.entries(parsed)
          .forEach(([ k, v ]) => {
            this.assets[k] = v;
          });
      });
  }
}
