import Ajv from 'ajv/lib/ajv';

import pagedClient from './client';
import schema from './schema';
import handlers from './handlers';

import { Assets, AssetTypes, Auth0APIClient } from '../../types';
import APIHandler from './handlers/default';
import { ConfigFunction } from '../../configFactory';

export type Stage = 'load' | 'validate' | 'processChanges';

type StageFunction = APIHandler['load']; // Using `load` method as a template for what type stage functions resemble

/**
 * Sorts handlers by their @order decorator metadata for a given stage.
 * Handlers are sorted in ascending order (lower values execute first).
 * Default order is 50 for handlers without explicit @order metadata.
 * Uses stable sort: preserves insertion order when order values are equal.
 *
 * @param toSort - Array of API handlers to sort
 * @param stage - The stage name (load, validate, processChanges)
 * @returns Sorted array of handlers
 */
function sortByOrder(toSort: APIHandler[], stage: Stage): APIHandler[] {
  const defaultOrder = 50;

  const sorted = [...toSort];
  sorted.sort((a, b) => {
    // @ts-ignore because stage methods may have order property
    const aOrderRaw = a[stage]?.order;
    // @ts-ignore because stage methods may have order property
    const bOrderRaw = b[stage]?.order;

    // Coerce to numbers, default to 50 if undefined/null
    const aOrder = aOrderRaw != null ? Number(aOrderRaw) : defaultOrder;
    const bOrder = bOrderRaw != null ? Number(bOrderRaw) : defaultOrder;

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
}
