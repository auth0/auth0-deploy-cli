import * as path from 'path';
import { logger } from 'src/logger';
import { isDirectory } from 'src/utils';
import handlers from 'src/context/directory/handlers';

export default class {
  constructor(filePath, mappings) {
    this.filePath = path.resolve(filePath);
    this.mappings = mappings;
    this.clients = {};
    this.databases = [];
    this.connections = [];
    this.pages = {};
    this.resourceServers = {};
    this.rules = {};
    this.excluded_rules = [];
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
              this[k] = v;
            });
        });
      return;
    }
    throw new Error(`Not sure what to do with, ${this.filePath} as it is not a directory...`);
  }

  async init(progress) {
    /* If mappings weren't provided, fall back to the ones provided to init() */
    this.mappings = this.mappings || (progress && progress.mappings);
    return this.load();
  }
}
