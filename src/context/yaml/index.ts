import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { ManagementClient } from 'auth0';
import {
  loadFileAndReplaceKeywords,
  keywordReplace,
  wrapArrayReplaceMarkersInQuotes,
  Auth0,
} from '../../tools';
import pagedClient from '../../tools/auth0/client';

import log from '../../logger';
import { isFile, toConfigFn, stripIdentifiers, formatResults, recordsSorter } from '../../utils';
import handlers, { YAMLHandler } from './handlers';
import cleanAssets from '../../readonly';
import { Assets, Config, Auth0APIClient, AssetTypes, KeywordMappings } from '../../types';
import { filterOnlyIncludedResourceTypes } from '..';
import { preserveKeywords } from '../../keywordPreservation';

export default class YAMLContext {
  basePath: string;
  configFile: string;
  config: Config;
  mappings: KeywordMappings;
  mgmtClient: Auth0APIClient;
  assets: Assets;
  disableKeywordReplacement: boolean;

  constructor(config: Config, mgmtClient: ManagementClient) {
    this.configFile = config.AUTH0_INPUT_FILE;
    this.config = config;
    this.mappings = config.AUTH0_KEYWORD_REPLACE_MAPPINGS || {};
    this.mgmtClient = pagedClient(mgmtClient);
    this.disableKeywordReplacement = false;

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

    this.assets.include = {
      connections: config.AUTH0_INCLUDED_CONNECTIONS || [],
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
    return loadFileAndReplaceKeywords(path.resolve(toLoad), {
      mappings: this.mappings,
      disableKeywordReplacement: this.disableKeywordReplacement,
    });
  }

  async loadAssetsFromLocal(opts = { disableKeywordReplacement: false }) {
    // Allow to send object/json directly
    this.disableKeywordReplacement = opts.disableKeywordReplacement;
    if (typeof this.configFile === 'object') {
      this.assets = this.configFile;
    } else {
      try {
        const fPath = path.resolve(this.configFile);
        log.debug(`Loading YAML from ${fPath}`);
        Object.assign(
          this.assets,
          yaml.load(
            opts.disableKeywordReplacement
              ? wrapArrayReplaceMarkersInQuotes(fs.readFileSync(fPath, 'utf8'), this.mappings)
              : keywordReplace(fs.readFileSync(fPath, 'utf8'), this.mappings)
          ) || {}
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

    const initialAssets: Assets = {
      exclude: this.assets.exclude, // Keep the exclude rules in result assets
    };
    this.assets = Object.keys(this.assets).reduce((acc: Assets, key: AssetTypes) => {
      // Get the list of asset types to include
      const includedAssetTypes = this.config.AUTH0_INCLUDED_ONLY;

      // If includedAssetTypes is defined and this asset type (key) is not in the list, exclude it
      if (includedAssetTypes !== undefined && !includedAssetTypes.includes(key)) return acc;

      // Otherwise, include the asset type in the result
      return {
        ...acc,
        [key]: this.assets[key],
      };
    }, initialAssets);

    // Run initial schema check to ensure valid YAML
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    if (!opts.disableKeywordReplacement) {
      // The schema validation needs to be disabled during keyword-preserved export because a field may be enforced as an array but will be expressed with an array replace marker (string).
      await auth0.validate();
    }

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
          throw new Error(`Problem deploying ${name}, ${err}`);
        }
      })
    );
  }

  async dump(): Promise<void> {
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    log.info('Loading Auth0 Tenant Data');
    try {
      await auth0.loadAssetsFromAuth0();

      const shouldPreserveKeywords =
        //@ts-ignore because the string=>boolean conversion may not have happened if passed-in as env var
        this.config.AUTH0_PRESERVE_KEYWORDS === 'true' ||
        this.config.AUTH0_PRESERVE_KEYWORDS === true;
      if (shouldPreserveKeywords) {
        await this.loadAssetsFromLocal({ disableKeywordReplacement: true }); //Need to disable keyword replacement to retrieve the raw keyword markers (ex: ##KEYWORD##)
        const localAssets = { ...this.assets };
        //@ts-ignore
        delete this['assets'];

        this.assets = preserveKeywords({
          localAssets,
          remoteAssets: auth0.assets,
          keywordMappings: this.config.AUTH0_KEYWORD_REPLACE_MAPPINGS || {},
          auth0Handlers: auth0.handlers,
        });
      } else {
        this.assets = auth0.assets;
      }
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
    delete cleaned.include;

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
