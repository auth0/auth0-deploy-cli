import Ajv from 'ajv/lib/ajv';

import pagedClient from './client';
import schema from './schema';
import handlers from './handlers';

import { Assets, Auth0APIClient } from '../../types'
import APIHandler from './handlers/default';
import { ConfigFunction } from '../../configFactory';



type Stage = 'load' | 'validate' | 'processChanges'

type StageFunction = APIHandler['load'] // Using `load` method as a template for what type stage functions resemble

function sortByOrder(toSort: APIHandler[], stage: Stage): APIHandler[] {
  const defaultOrder = 50

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
  client: Auth0APIClient
  config: ConfigFunction
  assets: Assets
  handlers: APIHandler[]

  constructor(client: Auth0APIClient, assets: Assets, config: ConfigFunction) {
    this.client = pagedClient(client);
    this.config = config;
    this.assets = assets;

    this.handlers = Object.values(handlers).map((handler) => {
      //@ts-ignore because prompts don't appear to have been universally implemented yet
      const newHandler = new handler.default({ client: this.client, config: this.config });
      return newHandler
    }).filter((handler) => {
      const excludedAssetTypes = config('AUTH0_EXCLUDED')
      return !excludedAssetTypes.includes(handler.type)
    })
  }

  async runStage(stage: Stage): Promise<void> {
    // Sort by priority
    for (const handler of sortByOrder(this.handlers, stage)) { // eslint-disable-line
      try {
        const stageFn: StageFunction = Object.getPrototypeOf(handler)[stage];
        this.assets = {
          ...this.assets,
          ...await stageFn.apply(handler, [this.assets]) || {}
        };
      } catch (err) {
        err.type = handler.type;
        err.stage = stage;
        throw err;
      }
    }
  }

  async validate(): Promise<void> {
    const ajv = new Ajv({ useDefaults: true });
    const valid = ajv.validate(schema, this.assets);
    if (!valid) {
      throw new Error(`Schema validation failed loading ${JSON.stringify(ajv.errors, null, 4)}`);
    }

    await this.runStage('validate');
  }

  async loadAll(): Promise<void> {
    // Populate assets from auth0 tenant
    await this.runStage('load');
  }

  async processChanges(): Promise<void> {
    await this.runStage('processChanges');
  }
}
