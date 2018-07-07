import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { keywordReplace } from 'auth0-source-control-extension-tools';

import { logger } from 'src/logger';
import handlers from 'src/context/yaml/handlers';

export default class {
  constructor(configFile, mappings) {
    this.configFile = configFile;
    this.configPath = path.dirname(configFile);
    this.mappings = mappings;
    this.assets = {
      clients: [],
      databases: [],
      connections: [],
      pages: [],
      resourceServers: [],
      rules: [],
      rulesConfigs: [],
      excluded_rules: []
    };
  }

  loadConfig() {
    try {
      const fPath = path.resolve(this.configFile);
      logger.debug(`Loading YAML from ${fPath}`);
      this.assets = yaml.safeLoad(keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings));

      // Allow handlers to process the assets such as loading files etc
      Object.values(handlers)
        .forEach((handler) => {
          const parsed = handler(this);
          Object.entries(parsed)
            .forEach(([ k, v ]) => {
              this.assets[k] = v;
            });
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
