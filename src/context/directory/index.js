import * as path from 'path';

import { logger } from '../../logger';
import { isDirectory } from '../../utils';
import handlers from '../../context/directory/handlers';

export default class {
  constructor(filePath, mappings) {
    this.filePath = path.resolve(filePath);
    this.mappings = mappings;
    this.assets = {
      clients: [],
      databases: [],
      connections: [],
      pages: [],
      resourceServers: [],
      rules: [],
      rulesConfigs: [],
      excludedRules: []
    };
  }

  async load() {
    if (isDirectory(this.filePath)) {
      /* If this is a directory, look for each file in the directory */
      logger.info(`Processing directory ${this.filePath}`);

      Object.values(handlers)
        .forEach((handler) => {
          const parsed = handler(this.filePath, this.mappings);
          Object.entries(parsed)
            .forEach(([ k, v ]) => {
              this.assets[k] = v;
            });
        });
      return;
    }
    throw new Error(`Not sure what to do with, ${this.filePath} as it is not a directory...`);
  }
}
