import { JSONApiResponse } from 'auth0';
import ValidationError from '../../validationError';

import {
  stripFields,
  convertJsonToString,
  duplicateItems,
  obfuscateSensitiveValues,
  stripObfuscatedFieldsFromPayload,
  detectInsufficientScopeError,
} from '../../utils';
import log from '../../../logger';
import { calculateChanges } from '../../calculateChanges';
import { Asset, Assets, Auth0APIClient, CalculatedChanges } from '../../../types';
import { ConfigFunction } from '../../../configFactory';

export function order(value) {
  return function decorator(t, n, descriptor) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      throw new Error(
        `Invalid @order value '${value}' for method '${n}'. The @order decorator only accepts numeric values. Received: ${typeof value}`
      );
    }

    descriptor.value.order = numericValue;
    return descriptor;
  };
}

type ApiMethodOverride = string | Function;

export default class APIHandler {
  config: ConfigFunction;
  id: string;
  type: string;
  updated: number;
  created: number;
  deleted: number;
  existing: null | Asset | Asset[];
  client: Auth0APIClient; // TODO: apply stronger types to Auth0 API client
  identifiers: string[];
  objectFields: string[];
  sensitiveFieldsToObfuscate: string[];
  stripUpdateFields: string[]; //Fields to strip from payload when updating
  stripCreateFields: string[]; //Fields to strip from payload when creating
  name?: string; // TODO: understand if any handlers actually leverage `name` property
  functions: {
    getAll: ApiMethodOverride;
    update: ApiMethodOverride;
    create: ApiMethodOverride;
    delete: ApiMethodOverride;
  };

  constructor(options: {
    id?: APIHandler['id'];
    config: ConfigFunction;
    type: APIHandler['type'];
    client: Auth0APIClient;
    objectFields?: APIHandler['objectFields'];
    identifiers?: APIHandler['identifiers'];
    stripUpdateFields?: APIHandler['stripUpdateFields'];
    sensitiveFieldsToObfuscate?: APIHandler['sensitiveFieldsToObfuscate'];
    stripCreateFields?: APIHandler['stripCreateFields'];
    functions: {
      getAll?: ApiMethodOverride;
      update?: ApiMethodOverride;
      create?: ApiMethodOverride;
      delete?: ApiMethodOverride;
    };
  }) {
    this.config = options.config;
    this.type = options.type;
    this.id = options.id || 'id';
    this.client = options.client;
    this.existing = null;
    this.identifiers = options.identifiers || ['id', 'name'];
    this.objectFields = options.objectFields || [];
    this.stripUpdateFields = [...(options.stripUpdateFields || []), this.id];
    this.sensitiveFieldsToObfuscate = options.sensitiveFieldsToObfuscate || [];
    this.stripCreateFields = options.stripCreateFields || [];

    this.functions = {
      getAll: 'getAll',
      create: 'create',
      delete: 'delete',
      update: 'update',
      ...(options.functions || {}),
    };

    this.updated = 0;
    this.created = 0;
    this.deleted = 0;
  }

  getClientFN(fn: ApiMethodOverride): Function {
    if (typeof fn === 'string') {
      const client = this.client[this.type];
      return client[fn].bind(client);
    }
    return fn;
  }

  didDelete(item: Asset): void {
    log.info(`Deleted [${this.type}]: ${this.objString(item)}`);
  }

  didCreate(item: Asset): void {
    if (typeof item === 'object' && item instanceof JSONApiResponse) {
      log.info(`Created [${this.type}]: ${this.objString(item?.data)}`);
    } else {
      log.info(`Created [${this.type}]: ${this.objString(item)}`);
    }
  }

  didUpdate(item: Asset): void {
    if (typeof item === 'object' && item instanceof JSONApiResponse) {
      log.info(`Updated [${this.type}]: ${this.objString(item?.data)}`);
    } else {
      log.info(`Updated [${this.type}]: ${this.objString(item)}`);
    }
  }

  objString(item: Asset): string {
    return convertJsonToString(item);
  }

  async getType(): Promise<Asset | Asset[] | null> {
    // Each type to impl how to get the existing as its not consistent across the mgnt api.
    throw new Error(`Must implement getType for type ${this.type}`);
  }

  async load(): Promise<{ [key: string]: Asset | Asset[] | null }> {
    // Load Asset from Tenant
    const data = await (async () => {
      const { data, hadSufficientScopes, requiredScopes } = await detectInsufficientScopeError<
        Asset | Asset[]
      >(this.getType.bind(this));
      if (!hadSufficientScopes) {
        log.warn(`Cannot retrieve ${this.type} due to missing scopes: ${requiredScopes}`);
        return null;
      }
      log.info(`Retrieving ${this.type} data from Auth0`);
      return data;
    })();

    this.existing = obfuscateSensitiveValues(data, this.sensitiveFieldsToObfuscate);

    return { [this.type]: this.existing };
  }

  async calcChanges(assets: Assets): Promise<CalculatedChanges> {
    const typeAssets = assets[this.type];

    // Do nothing if not set
    if (!typeAssets) {
      return {
        del: [],
        create: [],
        conflicts: [],
        update: [],
      };
    }

    const existing = await this.getType();

    // Figure out what needs to be updated vs created
    return calculateChanges({
      handler: this,
      assets: typeAssets,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
      //@ts-ignore TODO: investigate what happens when `existing` is null
      existing,
      identifiers: this.identifiers,
    });
  }

  async validate(assets: Assets): Promise<void> {
    // Ensure no duplication in id and name
    const typeAssets = assets[this.type];

    // Do nothing if not set
    if (!Array.isArray(typeAssets)) return;

    // Do not allow items with same name
    const duplicateNames = duplicateItems(typeAssets, 'name');
    if (duplicateNames.length > 0) {
      const formatted = duplicateNames.map((dups) => dups.map((d) => `${d.name}`));
      throw new ValidationError(`There are multiple ${this.type} with the same name combinations
      ${convertJsonToString(formatted)}.
       Names must be unique.`);
    }

    // Do not allow items with same id
    const duplicateIDs = duplicateItems(typeAssets, this.id);
    if (duplicateIDs.length > 0) {
      const formatted = duplicateIDs.map((dups) => dups.map((d) => `${d[this.id]}`));
      throw new ValidationError(`There are multiple ${
        this.type
      } for the following stage-order combinations
      ${convertJsonToString(formatted)}.
       Only one rule must be defined for the same order number in a stage.`);
    }
  }

  async processChanges(assets: Assets, changes: CalculatedChanges): Promise<void> {
    if (!changes) {
      changes = await this.calcChanges(assets);
    }

    const del = changes.del || [];
    const update = changes.update || [];
    const create = changes.create || [];
    const conflicts = changes.conflicts || [];

    log.debug(
      `Start processChanges for ${this.type} [delete:${del.length}] [update:${update.length}], [create:${create.length}], [conflicts:${conflicts.length}]`
    );

    // Process Deleted
    if (del.length > 0) {
      const allowDelete =
        this.config('AUTH0_ALLOW_DELETE') === 'true' || this.config('AUTH0_ALLOW_DELETE') === true;
      const byExtension =
        this.config('EXTENSION_SECRET') &&
        (this.type === 'rules' || this.type === 'resourceServers');
      const shouldDelete = allowDelete || byExtension;
      if (!shouldDelete) {
        log.warn(`Detected the following ${
          this.type
        } should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
        \n${changes.del.map((i) => this.objString(i)).join('\n')}
         `);
      } else {
        await this.client.pool
          .addEachTask({
            data: del || [],
            generator: (delItem) => {
              const delFunction = this.getClientFN(this.functions.delete);
              return delFunction({ [this.id]: delItem[this.id] })
                .then(() => {
                  this.didDelete(delItem);
                  this.deleted += 1;
                })
                .catch((err) => {
                  throw new Error(
                    `Problem deleting ${this.type} ${this.objString(delItem)}\n${err}`
                  );
                });
            },
          })
          .promise();
      }
    }

    // Process Renaming Entries Temp due to conflicts in names
    await this.client.pool
      .addEachTask({
        data: conflicts || [],
        generator: (updateItem) => {
          const updateFN = this.getClientFN(this.functions.update);
          const params = { [this.id]: updateItem[this.id] };
          const updatePayload = (() => {
            let data = stripFields({ ...updateItem }, this.stripUpdateFields);
            return stripObfuscatedFieldsFromPayload(data, this.sensitiveFieldsToObfuscate);
          })();
          return updateFN(params, updatePayload)
            .then((data) => this.didUpdate(data))
            .catch((err) => {
              throw new Error(
                `Problem updating ${this.type} ${this.objString(updateItem)}\n${err}`
              );
            });
        },
      })
      .promise();

    // Process Creations
    await this.client.pool
      .addEachTask({
        data: create || [],
        generator: (createItem) => {
          const createFunction = this.getClientFN(this.functions.create);
          const createPayload = (() => {
            const strippedPayload = stripFields(createItem, this.stripCreateFields);
            return stripObfuscatedFieldsFromPayload(
              strippedPayload,
              this.sensitiveFieldsToObfuscate
            );
          })();
          return createFunction(createPayload)
            .then((data) => {
              this.didCreate(data);
              this.created += 1;
            })
            .catch((err) => {
              throw new Error(
                `Problem creating ${this.type} ${this.objString(createItem)}\n${err}`
              );
            });
        },
      })
      .promise();

    // Process Updates and strip fields not allowed in updates
    await this.client.pool
      .addEachTask({
        data: update || [],
        generator: (updateItem) => {
          const updateFN = this.getClientFN(this.functions.update);
          const params = { [this.id]: updateItem[this.id] };
          const updatePayload = (() => {
            let data = stripFields({ ...updateItem }, this.stripUpdateFields);
            return stripObfuscatedFieldsFromPayload(data, this.sensitiveFieldsToObfuscate);
          })();
          return updateFN(params, updatePayload)
            .then((data) => {
              this.didUpdate(data);
              this.updated += 1;
            })
            .catch((err) => {
              throw new Error(
                `Problem updating ${this.type} ${this.objString(updateItem)}\n${err}`
              );
            });
        },
      })
      .promise();
  }
}
