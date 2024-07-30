import { Asset } from '../../../types';
import log from '../../../logger';
import { PromisePoolExecutor } from 'promise-pool-executor';
import { BaseAuth0APIClient } from '../../../types';
import { ConfigFunction } from '../../../configFactory';

interface IdMapValue {
  strategy: string;
  scimConfiguration?: Asset;
}

interface ScimRequestParams {
  id: string;
}

interface ScimBodyParams {
  user_id_attribute: string;
  mapping: { scim: string; auth0: string }[];
}

interface ScimScopes { read: boolean; create: boolean; update: boolean; delete: boolean }

/**
 * The current version of this sdk use `node-auth0` v3. But `SCIM` features are not natively supported by v3.
 * This is a workaround to make this SDK support SCIM without `node-auth0` upgrade.
 */
export default class ScimHandler {
  private idMap: Map<string, IdMapValue>;
  private readonly scimStrategies = ['samlp', 'oidc', 'okta', 'waad'];
  private config: ConfigFunction;
  private connectionsManager: BaseAuth0APIClient['connections'];
  private scimScopes: ScimScopes = { read: true, create: true, update: true, delete: true };
  private scopeMethodMap = {
    get: 'read',
    post: 'create',
    patch: 'update',
    delete: 'delete'
  }
  private scimClient: any;
  private poolClient: PromisePoolExecutor;
    
  constructor(config, connectionsManager, poolClient: PromisePoolExecutor) {
    this.config = config;
    this.connectionsManager = connectionsManager;
    this.scimClient = connectionsManager?._getRestClient('/connections/:id/scim-configuration');
    this.poolClient = poolClient;
    this.idMap = new Map<string, IdMapValue>();
  }

  /**
   * Check if the connection strategy is SCIM supported.
   * Only few of the enterprise connections are SCIM supported.
   */
  isScimStrategy(strategy: string) {
    return this.scimStrategies.includes(strategy.toLowerCase());
  }
  
  /**
   * Creates connection_id -> { strategy, scimConfiguration } map.
   * Store only the SCIM ids available on the existing / remote config.
   * Payload received on `create` and `update` methods has the property `strategy` stripped.
   * So, we need this map to perform `create`, `update` or `delete` actions on SCIM.
   * @param connections
   */
  async createIdMap(connections: Asset[]) {
    this.idMap.clear();
    log.info('Reviewing connections for SCIM support. This may take a while...');

    await this.poolClient.addEachTask({
      data: connections || [],
      generator: (connection) => {
        if (!this.scimScopes.read) return Promise.resolve(null);
        if (!this.isScimStrategy(connection.strategy)) return Promise.resolve(null);

        this.idMap.set(connection.id, { strategy: connection.strategy });
        return this.getScimConfiguration({ id: connection.id }).then((scimConfiguration) => {
          if (scimConfiguration) {
            const { mapping, user_id_attribute, connection_id } = scimConfiguration;
            this.idMap.set(connection_id, { ...this.idMap.get(connection_id)!, scimConfiguration : { mapping, user_id_attribute } });
          }
        }).catch((error) => {
          throw new Error(
            `Problem fetching SCIM configurations while running \"createIdMap\".\n${ error }`
          );
        });
      },
    })
    .promise();
  }

  /**
   * Iterate through all the connections and add property `scim_configuration` to only `SCIM` connections.
   * The following conditions should be met to have `scim_configuration` set to a `connection`.
   * 1. Connection `strategy` should be one of `scimStrategies`
   * 2. Connection should have `SCIM` enabled.
   * 
   * This method mutates the incoming `connections`.
   */
  async applyScimConfiguration(connections: Asset[]) {
    // If `this.idMap` is empty, it means we haven't created the idMap yet. Create it.
    // If `this.scimScopes.read` is false, it means we don't have `read:scim_config` scope. Return connections as is.
    if (this.idMap.size === 0) {
      if (!this.scimScopes.read) return connections;

      await this.createIdMap(connections);
    }

    for (const connection of connections) {
      const { scimConfiguration } = this.idMap.get(connection.id) || {};

      if (scimConfiguration) {
        connection.scim_configuration = scimConfiguration;
      }
    }
  }
  
  /** 
   * Wrapper over scimClient methods.
  */
  private async useScimClient(method: string, options: [ScimRequestParams, ...Record<string, any>[]]): Promise<Asset> {
    return await this.withErrorHandling(async () => {
      return await this.scimClient[method](...options);
    }, method, options[0].id);
  } 

  /**
   * Error handler wrapper.
   */
  async withErrorHandling(callback, method: string, connectionId: string) {
    try {
      return await callback();
    } catch (error) {
      return this.handleExpectedErrors(error, method, connectionId);
    }
  }
  
  /**
  * Handle expected errors.
  */
  handleExpectedErrors(error, method: string, connectionId: string) {
    // Skip the connection if it returns 404. This can happen if `SCIM` is not enabled on a `SCIM` connection.
    if (error && error.statusCode === 404) {
      log.debug(`SCIM configuration is not enabled on connection \"${ connectionId }\".`);
      return null;
    };

    // Skip the connection if it returns 403. Looks like "scim_config" permissions are not enabled on Management API. 
    if (error && error.statusCode === 403) {
      const scope = this.scopeMethodMap[method];
      this.scimScopes[scope] = false;

      const warningMessage = `Insufficient scope, \"${ scope }:scim_config\". Required \"read:scim_config\", \"create:scim_config\", \"update:scim_config\" and \"delete:scim_config\".`;
      const suggestionText = `If you are not using SCIM, you can keep these permissions disabled and ignore this warning.`;

      log.warn(`${ warningMessage }\n${ suggestionText }\n`);
      return null;
    }

    // Skip the connection if it returns 400. This can happen if `SCIM` configuration already exists on a `SCIM` connection.
    if (error && error.statusCode === 400 && error.message?.includes('already exists')) {
      log.warn(`SCIM configuration already exists on connection \"${ connectionId }\".`);
      return null;
    }

    // Rate limiting errors should be mostly handled by `scimClient`. But, in the worst case scenario also we don;t want to break the pipeline.
    if (error && error.statusCode === 429) {
      log.error(`The global rate limit has been exceeded, resulting in a ${ error.statusCode } error. ${ error.message }. Although this is an error, it is not blocking the pipeline.`);
      return null;
    }

    log.error(`SCIM request failed with status code ${ error.statusCode }. ${ error.message || error.toString() }.`);
    throw error;
  }

  /**
   * Creates a new `SCIM` configuration.
   */
  async createScimConfiguration({ id: connection_id }: ScimRequestParams, { user_id_attribute, mapping }: ScimBodyParams): Promise<Asset | null> {
    log.debug(`Creating SCIM configuration on connection ${ connection_id }`);
    return await this.useScimClient('create', [ { id: connection_id }, { user_id_attribute, mapping } ]);
  }

  /**
   * Retrieves `SCIM` configuration of an enterprise connection.
   */
  async getScimConfiguration({ id: connection_id }: ScimRequestParams): Promise<Asset | null> {
    log.debug(`Getting SCIM configuration from connection ${ connection_id }`);
    return await this.useScimClient('get', [ { id: connection_id } ]);
  }

  /**
   * Updates an existing `SCIM` configuration.
   */
  async updateScimConfiguration({ id: connection_id }: ScimRequestParams, { user_id_attribute, mapping }: ScimBodyParams): Promise<Asset | null> {
    log.debug(`Updating SCIM configuration on connection ${ connection_id }`);
    return await this.useScimClient('patch', [ { id: connection_id }, { user_id_attribute, mapping } ]);
  }

  /**
   * Deletes an existing `SCIM` configuration.
   */
  async deleteScimConfiguration({ id: connection_id }: ScimRequestParams): Promise<Asset | null>  {
    log.debug(`Deleting SCIM configuration on connection ${ connection_id }`);
    return await this.useScimClient('delete', [ { id: connection_id } ]);
  }
  
  async updateOverride(requestParams: ScimRequestParams, bodyParams: Asset) {
    // Extract `scim_configuration` from `bodyParams`.
    // Remove `scim_configuration` from `bodyParams`, because `connections.update` doesn't accept it.
    const { scim_configuration: scimBodyParams } = bodyParams;
    delete bodyParams.scim_configuration;

    // First, update `connections`.
    const updated = await this.connectionsManager.update(requestParams, bodyParams);
    const idMapEntry = this.idMap.get(requestParams.id);

    // Now, update `scim_configuration` inside the updated connection.
    // If `scim_configuration` exists in both local and remote -> updateScimConfiguration(...)
    // If `scim_configuration` exists in remote but local -> deleteScimConfiguration(...)
    // If `scim_configuration` exists in local but remote -> createScimConfiguration(...)

    if (idMapEntry?.scimConfiguration) {
      if (scimBodyParams) {
        if (this.scimScopes.update) {
          await this.updateScimConfiguration(requestParams, scimBodyParams);
        }
      } else {
        if (this.config('AUTH0_ALLOW_DELETE')) {
          if (this.scimScopes.delete) {
            await this.deleteScimConfiguration(requestParams);
          }
        } else {
          log.warn(`Skipping DELETE scim_configuration on \"${ requestParams.id }\". Enable deletes by setting \"AUTH0_ALLOW_DELETE\" to true in your config.`);
        }
      }
    } else if (scimBodyParams && this.scimScopes.create) {
      await this.createScimConfiguration(requestParams, scimBodyParams);
    }

    // Return response from connections.update(...). 
    return updated;
  }

  async createOverride(bodyParams: Asset) {
    // Extract `scim_configuration` from `bodyParams`.
    // Remove `scim_configuration` from `bodyParams`, because `connections.create` doesn't accept it.
    const { scim_configuration: scimBodyParams } = bodyParams;
    delete bodyParams.scim_configuration;

    // First, create the new `connection`.
    const created = await this.connectionsManager.create(bodyParams);

    if (scimBodyParams && this.scimScopes.create) {
      // Now, create the `scim_configuration` for newly created `connection`.
      await this.createScimConfiguration({id: created.id}, scimBodyParams);
    }

    // Return response from connections.create(...). 
    return created;
  }
}

