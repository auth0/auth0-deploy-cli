import Ajv from 'ajv/lib/ajv';
import { cloneDeep } from 'lodash';

import pagedClient from './client';
import schema from './schema';
import handlers from './handlers';

import {
  Assets,
  AssetTypes,
  Auth0APIClient,
  CalculatedChanges,
  DetailedDryRunChanges,
  DetailedDryRunChange,
} from '../../types';
import APIHandler from './handlers/default';
import { ConfigFunction } from '../../configFactory';
import { dryRunFormatAssets } from '../calculateChanges';

export type Stage = 'load' | 'validate' | 'processChanges';

type StageFunction = APIHandler['load']; // Using `load` method as a template for what type stage functions resemble

function sortByOrder(toSort: APIHandler[], stage: Stage): APIHandler[] {
  const defaultOrder = 50;

  const sorted = [...toSort];
  sorted.sort((a, b) => {
    //@ts-ignore because this doesn't actually work. TODO: apply stage order
    const aOrder = a[stage].order || defaultOrder;
    //@ts-ignore because this doesn't actually work. TODO: apply stage order
    const bOrder = b[stage].order || defaultOrder;
    return aOrder - bOrder;
  });
  return sorted;
}

export default class Auth0 {
  client: Auth0APIClient;
  config: ConfigFunction;
  assets: Assets;
  handlers: APIHandler[];

  constructor(client: Auth0APIClient, assets: Assets, config: ConfigFunction) {
    this.client = pagedClient(client);
    this.config = config;
    this.assets = assets;

    this.handlers = Object.values(handlers)
      .map((handler) => {
        //@ts-ignore because class expects `type` property but gets directly injected into class constructors
        return new handler.default({ client: this.client, config: this.config });
      })
      .filter((handler) => {
        const excludedAssetTypes: undefined | AssetTypes[] = config('AUTH0_EXCLUDED');

        if (excludedAssetTypes === undefined) return true;

        return !excludedAssetTypes.includes(handler.type as AssetTypes);
      })
      .filter((handler) => {
        const onlyIncludedAssetTypes: undefined | AssetTypes[] = config('AUTH0_INCLUDED_ONLY');

        if (onlyIncludedAssetTypes === undefined) return true;

        return onlyIncludedAssetTypes.includes(handler.type as AssetTypes);
      });
  }

  async runStage(stage: Stage): Promise<void> {
    // Sort by priority
    for (const handler of sortByOrder(this.handlers, stage)) {
      // eslint-disable-line
      try {
        const stageFn: StageFunction = Object.getPrototypeOf(handler)[stage];
        this.assets = {
          ...this.assets,
          ...((await stageFn.apply(handler, [this.assets])) || {}),
        };
      } catch (err) {
        err.type = handler.type;
        err.stage = stage;
        throw err;
      }
    }
  }

  async validate(): Promise<void> {
    const ajv = new Ajv({ useDefaults: true, nullable: true });
    const nonNullAssets = Object.keys(this.assets)
      .filter((k) => this.assets[k] != null)
      .reduce((a, k) => ({ ...a, [k]: this.assets[k] }), {});
    const valid = ajv.validate(schema, nonNullAssets);
    if (!valid) {
      throw new Error(`Schema validation failed loading ${JSON.stringify(ajv.errors, null, 4)}`);
    }

    await this.runStage('validate');
  }

  async loadAssetsFromAuth0(): Promise<void> {
    // Populate assets from auth0 tenant
    await this.runStage('load');
  }

  async processChanges(): Promise<void> {
    await this.runStage('processChanges');
  }

  async dryRun(): Promise<DetailedDryRunChanges> {
    // In dry run mode, perform a dry run instead of processing changes
    const allChanges: DetailedDryRunChanges = {};

    this.assets = await dryRunFormatAssets(cloneDeep(this.assets), this.client);

    // Process each handler to collect changes
    await Promise.all(
      this.handlers.map(async (handler) => {
        try {
          const detailedChanges: DetailedDryRunChange[] = [];
          let created = 0;
          let updated = 0;
          let deleted = 0;

          const typeAssets = this.assets[handler.type];

          // Check if this is a collection (array) or singleton handler
          const isCollection = Array.isArray(typeAssets);

          if (isCollection && typeof handler.calcChanges === 'function') {
            // Calculate changes for collection handlers
            //const changes: CalculatedChanges = await handler.calcChanges(this.assets);
            const changes: CalculatedChanges = await handler.dryRunChanges(this.assets);

            // Add detailed information for each change
            if (changes.create) {
              changes.create.forEach((item) => {
                detailedChanges.push({
                  action: 'CREATE' as const,
                  identifier: handler.getResourceName(item),
                  details: item,
                });
              });
              created = changes.create.length;
            }

            if (changes.update) {
              changes.update.forEach((item) => {
                detailedChanges.push({
                  action: 'UPDATE' as const,
                  identifier: handler.getResourceName(item),
                  details: item,
                });
              });
              updated = changes.update.length;
            }

            if (changes.del) {
              changes.del.forEach((item) => {
                detailedChanges.push({
                  action: 'DELETE' as const,
                  identifier: handler.getResourceName(item),
                  details: item,
                });
              });
              deleted = changes.del.length;
            }
          } else if (typeAssets && !isCollection) {
            // Handle singleton handlers (tenant, branding, etc.)
            // For singleton handlers, if asset exists it would be an update
            detailedChanges.push({
              action: 'UPDATE' as const,
              identifier: handler.getResourceName(typeAssets),
              details: typeAssets,
            });
            updated = 1;
          }

          allChanges[handler.type] = {
            created,
            updated,
            deleted,
            changes: detailedChanges,
          };
        } catch (err) {
          err.type = handler.type;
          err.stage = 'dryRun';
          throw err;
        }
      })
    );

    return allChanges;
  }
}
