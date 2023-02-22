import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { loadFileAndReplaceKeywords, keywordReplace, Auth0 } from '../../tools';

import log from '../../logger';
import { isFile, toConfigFn, stripIdentifiers, formatResults, recordsSorter } from '../../utils';
import handlers, { YAMLHandler } from './handlers';
import cleanAssets from '../../readonly';
import { Assets, Config, Auth0APIClient, AssetTypes, KeywordMappings } from '../../types';
import { filterOnlyIncludedResourceTypes } from '..';

export default class YAMLContext {
  basePath: string;
  configFile: string;
  config: Config;
  mappings: KeywordMappings;
  mgmtClient: Auth0APIClient;
  assets: Assets;

  constructor(config: Config, mgmtClient) {
    this.configFile = config.AUTH0_INPUT_FILE;
    this.config = config;
    this.mappings = config.AUTH0_KEYWORD_REPLACE_MAPPINGS || {};
    this.mgmtClient = mgmtClient;

    //@ts-ignore because the assets property gets filled out throughout
    this.assets = {};
    // Get excluded rules
    this.assets.exclude = {
      rules: config.AUTH0_EXCLUDED_RULES || [],
      clients: config.AUTH0_EXCLUDED_CLIENTS || [],
      databases: config.AUTH0_EXCLUDED_DATABASES || [],
      connections: config.AUTH0_EXCLUDED_CONNECTIONS || [],
      resourceServers: config.AUTH0_EXCLUDED_RESOURCE_SERVERS || [],
      defaults: config.AUTH0_EXCLUDED_DEFAULTS || [],
    };

    this.basePath = (() => {
      if (!!config.AUTH0_BASE_PATH) return config.AUTH0_BASE_PATH;
      //@ts-ignore because this looks to be a bug, but do not want to introduce regression; more investigation needed
      return typeof configFile === 'object' ? process.cwd() : path.dirname(this.configFile);
    })();
  }

  loadFile(f) {
    let toLoad = path.join(this.basePath, f);
    if (!isFile(toLoad)) {
      // try load not relative to yaml file
      toLoad = f;
    }
    return loadFileAndReplaceKeywords(path.resolve(toLoad), this.mappings);
  }

  async loadAssetsFromLocal() {
    // Allow to send object/json directly
    if (typeof this.configFile === 'object') {
      this.assets = this.configFile;
    } else {
      try {
        const fPath = path.resolve(this.configFile);
        log.debug(`Loading YAML from ${fPath}`);
        Object.assign(
          this.assets,
          yaml.load(keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings)) || {}
        );
      } catch (err) {
        log.debug(err.stack);
        throw new Error(`Problem loading ${this.configFile}\n${err}`);
      }
    }

    this.assets = Object.keys(this.assets).reduce((acc: Assets, key: AssetTypes) => {
      const excludedAssetTypes = this.config.AUTH0_EXCLUDED || [];
      if (excludedAssetTypes.includes(key)) return acc;

      return {
        ...acc,
        [key]: this.assets[key],
      };
    }, {});

    this.assets = Object.keys(this.assets).reduce((acc: Assets, key: AssetTypes) => {
      const includedAssetTypes = this.config.AUTH0_INCLUDED_ONLY;

      if (includedAssetTypes !== undefined && !includedAssetTypes.includes(key)) return acc;

      return {
        ...acc,
        [key]: this.assets[key],
      };
    }, {});

    // Run initial schema check to ensure valid YAML
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    await auth0.validate();

    // Allow handlers to process the assets such as loading files etc
    await Promise.all(
      Object.entries(handlers).map(async ([name, handler]) => {
        try {
          const parsed = await handler.parse(this);
          Object.entries(parsed).forEach(([k, v]) => {
            this.assets[k] = v;
          });
        } catch (err) {
          log.debug(err.stack);
          throw new Error(`Problem deploying ${name}`);
        }
      })
    );
  }

  async dump(): Promise<void> {
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    log.info('Loading Auth0 Tenant Data');
    try {
      await auth0.loadAll();
      this.assets = auth0.assets;
    } catch (err) {
      const docUrl =
        'https://auth0.com/docs/deploy/deploy-cli-tool/create-and-configure-the-deploy-cli-application#modify-deploy-cli-application-scopes';
      const extraMessage = err.message.startsWith('Insufficient scope')
        ? `\nSee ${docUrl} for more information`
        : '';
      throw new Error(`Problem loading tenant data from Auth0 ${err}${extraMessage}`);
    }

    await Promise.all(
      Object.entries(handlers)
        .filter(([handlerName]: [AssetTypes, YAMLHandler<any>]) => {
          const excludedAssetTypes = this.config.AUTH0_EXCLUDED || [];
          return !excludedAssetTypes.includes(handlerName);
        })
        .filter(filterOnlyIncludedResourceTypes(this.config.AUTH0_INCLUDED_ONLY))
        .map(async ([name, handler]) => {
          try {
            const data = await handler.dump(this);
            if (data) {
              if (data[name] !== null) log.info(`Exporting ${name}`);
              Object.entries(data).forEach(([k, v]) => {
                this.assets[k] = Array.isArray(v)
                  ? v.map(formatResults).sort(recordsSorter)
                  : formatResults(v);
              });
            }
          } catch (err) {
            log.debug(err.stack);
            throw new Error(`Problem exporting ${name}`);
          }
        })
    );

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
