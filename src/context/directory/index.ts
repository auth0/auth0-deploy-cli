import * as path from 'path';
import { ManagementClient } from 'auth0';
import { loadFileAndReplaceKeywords, Auth0 } from '../../tools';
import pagedClient from '../../tools/auth0/client';

import cleanAssets from '../../readonly';
import log from '../../logger';
import handlers, { DirectoryHandler } from './handlers';
import { isDirectory, isFile, stripIdentifiers, toConfigFn } from '../../utils';
import { Assets, Auth0APIClient, Config, AssetTypes } from '../../types';
import { filterOnlyIncludedResourceTypes } from '..';
import { preserveKeywords } from '../../keywordPreservation';

type KeywordMappings = { [key: string]: (string | number)[] | string | number };

export default class DirectoryContext {
  basePath: string;
  filePath: string;
  config: Config;
  mappings: KeywordMappings;
  mgmtClient: Auth0APIClient;
  assets: Assets;
  disableKeywordReplacement: boolean;

  constructor(config: Config, mgmtClient: ManagementClient) {
    this.filePath = config.AUTH0_INPUT_FILE;
    this.config = config;
    this.mappings = config.AUTH0_KEYWORD_REPLACE_MAPPINGS || {};
    this.mgmtClient = pagedClient(mgmtClient);
    this.disableKeywordReplacement = false;

    //@ts-ignore for now
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
  }

  loadFile(f: string, folder: string) {
    const basePath = path.join(this.filePath, folder);
    let toLoad = path.join(basePath, f);
    if (!isFile(toLoad)) {
      // try load not relative to yaml file
      toLoad = f;
    }
    return loadFileAndReplaceKeywords(toLoad, {
      mappings: this.mappings,
      disableKeywordReplacement: this.disableKeywordReplacement,
    });
  }

  async loadAssetsFromLocal(opts = { disableKeywordReplacement: false }): Promise<void> {
    this.disableKeywordReplacement = opts.disableKeywordReplacement;
    if (isDirectory(this.filePath)) {
      /* If this is a directory, look for each file in the directory */
      log.info(`Processing directory ${this.filePath}`);

      Object.entries(handlers)
        .filter(([handlerName]: [AssetTypes, DirectoryHandler<any>]) => {
          const excludedAssetTypes = this.config.AUTH0_EXCLUDED || [];
          return !excludedAssetTypes.includes(handlerName);
        })
        .filter(filterOnlyIncludedResourceTypes(this.config.AUTH0_INCLUDED_ONLY))
        .forEach(([_name, handler]) => {
          const parsed = handler.parse(this);
          Object.entries(parsed).forEach(([k, v]) => {
            this.assets[k] = v;
          });
        });
      return;
    }
    throw new Error(`Not sure what to do with, ${this.filePath} as it is not a directory...`);
  }

  async dump(): Promise<void> {
    const auth0 = new Auth0(this.mgmtClient, this.assets, toConfigFn(this.config));
    log.info('Loading Auth0 Tenant Data');
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

    // Clean known read only fields
    this.assets = cleanAssets(this.assets, this.config);

    // Copy clients to be used by handlers which require converting client_id to the name
    // Must copy as the client_id will be stripped if AUTH0_EXPORT_IDENTIFIERS is false
    //@ts-ignore because assets haven't been typed yet TODO: type assets
    this.assets.clientsOrig = [...(this.assets.clients || [])];

    // Optionally Strip identifiers
    if (!this.config.AUTH0_EXPORT_IDENTIFIERS) {
      this.assets = stripIdentifiers(auth0, this.assets);
    }

    await Promise.all(
      Object.entries(handlers)
        .filter(([handlerName]: [AssetTypes, DirectoryHandler<any>]) => {
          const excludedAssetTypes = this.config.AUTH0_EXCLUDED || [];
          return !excludedAssetTypes.includes(handlerName);
        })
        .filter(filterOnlyIncludedResourceTypes(this.config.AUTH0_INCLUDED_ONLY))
        .map(async ([name, handler]) => {
          try {
            await handler.dump(this);
          } catch (err) {
            log.debug(err.stack);
            throw new Error(`Problem exporting ${name}`);
          }
        })
    );
  }
}
