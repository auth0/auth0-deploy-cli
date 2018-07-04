import fs from 'fs';
import Ajv from 'ajv/lib/ajv';
import yaml from 'js-yaml';
import path from 'path';

import { logger } from 'src/logger';
import { keywordReplace } from 'src/utils';
import schema from 'src/context/yaml/schema';
import handlers from 'src/context/yaml/handlers';


export default class {
  constructor(configFile, mappings) {
    this.configFile = configFile;
    this.config = {};
    this.mappings = mappings;
    this.clients = {};
    this.databases = [];
    this.connections = [];
    this.pages = {};
    this.resourceServers = {};
    this.rules = {};
    this.excluded_rules = [];
  }

  validate() {
    const ajv = new Ajv({ useDefaults: true });
    const valid = ajv.validate(schema, this.config);
    if (!valid) {
      throw new Error(`Schema validation failed loading ${JSON.stringify(ajv.errors, null, 4)}`);
    }
  }

  loadConfig() {
    try {
      const fPath = path.resolve(this.configFile);
      logger.debug(`Loading YAML from ${fPath}`);

      this.config = yaml.safeLoad(keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings)) || {};

      // Validate schema
      this.validate();

      Object.entries(this.config).forEach(([ key, data ]) => {
        // Process each handler type
        const handler = handlers[key];
        if (!handler) {
          throw new Error(`Unable to load or find object handler ${key}`);
        }
        if (handler.parse) {
          const parsed = handler.parse(data);
          Object.entries(parsed).forEach(([ k, v ]) => {
            this[k] = v;
          });
        }
      });
    } catch (e) {
      logger.error(e.stack);
      throw new Error(`Problem loading ${this.configFile}\n${e}`);
    }
  }

  async init() {
    this.loadConfig();
  }
}
