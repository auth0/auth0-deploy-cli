import { Asset } from '../../../types';
import axios, { AxiosResponse } from 'axios';
import log from '../../../logger';
import { sleep } from '../../utils';

interface IdMapValue {
  strategy: string;
  hasConfig: boolean;
}

interface scimRequestParams {
	id: string;
}

interface scimBodyParams {
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
	private tokenProvider: any;
	private config: any;
	private connectionsManager: any;
	private updateQueue: any[] = [];
	private isExecuting = false;
	private scimScopes: ScimScopes = { read: true, create: true, update: true, delete: true };
	private scopeMethodMap = {
		get: 'read',
		post: 'create',
		patch: 'update',
		delete: 'delete'
	}

	expectedChanges: number = 0;
	completedChanges: number = 0;
    
	constructor(config, tokenProvider, connectionsManager) {
		this.config = config;
		this.tokenProvider = tokenProvider;
		this.connectionsManager = connectionsManager;
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
	 * Creates connection_id -> { strategy, hasConfig } map.
	 * Store only the SCIM ids available on the existing / remote config.
	 * Payload received on `create` and `update` methods has the property `strategy` stripped.
	 * So, we need this map to perform `create`, `update` or `delete` actions on SCIM.
	 * @param connections
	 */
	async createIdMap(connections: Asset[]) {
		this.idMap.clear();

		for (let connection of connections) {
			if (!this.scimScopes.read) return;
			if (!this.isScimStrategy(connection.strategy)) continue;
      
      // To avoid rate limiter error, we making API requests with a small delay.
      // TODO: However, this logic needs to be re-worked.
			await sleep(250);

      this.idMap.set(connection.id, { strategy: connection.strategy, hasConfig: false });
      const scimConfiguration = await this.getScimConfiguration({ id: connection.id });
      if (!scimConfiguration) continue;

      this.idMap.set(connection.id, { ...this.idMap.get(connection.id)!, hasConfig: true });
		}
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
		for (let connection of connections) {
			if (!this.scimScopes.read) return connections;
			if (!this.isScimStrategy(connection.strategy)) continue;
			
			// To avoid rate limiter error, we making API requests with a small delay.
			// TODO: However, this logic needs to be re-worked.
			await sleep(250);

			const scimConfiguration = await this.getScimConfiguration({ id: connection.id });
			if (!scimConfiguration) continue;
			
			const { user_id_attribute, mapping } = scimConfiguration;
			connection.scim_configuration = { user_id_attribute, mapping };
		}
	}
  
	/** 
   * HTTP request wrapper on axios.
  */
 private async scimHttpRequest(method: string, options: [string, ...Record<string, any>[]]): Promise<AxiosResponse> {
   return await this.withErrorHandling(async () => {
			// @ts-ignore
			const accessToken = await this.tokenProvider?.getAccessToken();
			const headers = { 
				'Accept': 'application/json',
				'Authorization': `Bearer ${ accessToken }`
			}
			options = [...options, { headers }];
			return await axios[method](...options);
		}, method, options[0]);
	}

	/**
	 * Error handler wrapper.
	 */
	async withErrorHandling(callback, method: string, url: string) {
		try {
			return await callback();
		} catch (error) {
			// Extract connection_id from the url.
			const regex = /api\/v2\/connections\/(.*?)\/scim-configuration/;
			const match = url.match(regex);
			const connectionId = match ? match[1] : null;

			// Extract error data
			const errorData = error?.response?.data;

      // Skip the connection if it returns 404. This can happen if `SCIM` is not enabled on a `SCIM` connection.
			if (errorData?.statusCode === 404) {
        const warningMessage = `SCIM configuration is not enabled on connection \"${ connectionId }\".`;
        log.warn(warningMessage);
        return { data: null };
      };

      // Skip the connection if it returns 403. Looks like "scim_config" permissions are not enabled on Management API. 
			if (errorData?.statusCode === 403) {
				const scope = this.scopeMethodMap[method];
				this.scimScopes[scope] = false;
        const warningMessage = `Insufficient scope, "${ scope }:scim_config". Looks like "scim_config" permissions are not enabled your application.`;
        log.warn(warningMessage);
        return { data: null };
      }

			// Skip the connection if it returns 400. This can happen if `SCIM` configuration already exists on a `SCIM` connection.
			// When `read:scim_config` is disabled and `create:scim_config` is enabled, we cannot check if `SCIM` configuration exists on a connection.
			// So, it'll run into 400 error.
			if (errorData?.statusCode === 400 && errorData?.message?.includes('already exists')) {
				const warningMessage = `SCIM configuration already exists on connection \"${ connectionId }\".`;
				log.warn(warningMessage);
				return { data: null };
			}

			const statusCode = errorData?.statusCode || error?.response?.status;
			const errorCode = errorData?.errorCode || errorData?.error || error?.response?.statusText;
			const errorMessage = errorData?.message || error?.response?.statusText;
			const message = `SCIM request failed with statusCode ${ statusCode } (${ errorCode }). ${ errorMessage }.`;

			log.error(message);
			throw error;
		}
	}

	/**
	 * Returns formatted endpoint url.
	 */
	private getScimEndpoint(connection_id: string) {
		// Call `scim-configuration` endpoint directly to support `SCIM` features.
		return `https://${ this.config('AUTH0_DOMAIN') }/api/v2/connections/${ connection_id }/scim-configuration`;
	}

	/**
	 * Creates a new `SCIM` configuration.
	 */
	async createScimConfiguration({ id: connection_id }: scimRequestParams, { user_id_attribute, mapping }: scimBodyParams): Promise<AxiosResponse> {
		log.debug(`Creating SCIM configuration on connection ${ connection_id }`);
		const url = this.getScimEndpoint(connection_id);
		return (await this.scimHttpRequest('post', [ url, { user_id_attribute, mapping } ])).data;
	}

	/**
	 * Retrieves `SCIM` configuration of an enterprise connection.
	 */
	async getScimConfiguration({ id: connection_id }: scimRequestParams): Promise<scimBodyParams> {
		log.debug(`Getting SCIM configuration from connection ${ connection_id }`);
		const url = this.getScimEndpoint(connection_id);
		return (await this.scimHttpRequest('get', [ url ])).data;
	}

	/**
	 * Updates an existing `SCIM` configuration.
	 */
	async updateScimConfiguration({ id: connection_id }: scimRequestParams, { user_id_attribute, mapping }: scimBodyParams): Promise<AxiosResponse> {
		log.debug(`Updating SCIM configuration on connection ${ connection_id }`);
		const url = this.getScimEndpoint(connection_id);
		return (await this.scimHttpRequest('patch', [ url, { user_id_attribute, mapping } ])).data;
	}

	/**
	 * Deletes an existing `SCIM` configuration.
	 */
	async deleteScimConfiguration({ id: connection_id }: scimRequestParams): Promise<AxiosResponse>  {
		log.debug(`Deleting SCIM configuration on connection ${ connection_id }`);
		const url = this.getScimEndpoint(connection_id);
		return (await this.scimHttpRequest('delete', [ url ])).data;
	}
  
	async updateOverride(requestParams: scimRequestParams, bodyParams: Asset) {
		// Extract `scim_configuration` from `bodyParams`.
		// Remove `scim_configuration` from `bodyParams`, because `connections.update` doesn't accept it.
		const { scim_configuration: scimBodyParams } = bodyParams;
		delete bodyParams.scim_configuration;

		// First, update `connections`.
		const updated = await this.connectionsManager.update(requestParams, bodyParams);
		const idMapEntry = this.idMap.get(requestParams.id);
    this.completedChanges ++;

		// Now, update `scim_configuration` inside the updated connection.
		// If `scim_configuration` exists in both local and remote -> updateScimConfiguration(...)
		// If `scim_configuration` exists in remote but local -> deleteScimConfiguration(...)
		// If `scim_configuration` exists in local but remote -> createScimConfiguration(...)
		if (idMapEntry?.hasConfig) {
			if (scimBodyParams) {
        this.updateQueue.push({action: 'update', requestParams, scimBodyParams});
			} else {
				if (this.config('AUTH0_ALLOW_DELETE')) {
					this.updateQueue.push({action: 'delete', requestParams});
				} else {
					log.warn('Skipping DELETE scim_configuration. Enable deletes by setting AUTH0_ALLOW_DELETE to true in your config.');
				}
			}
		} else if (scimBodyParams) {
			this.updateQueue.push({action: 'create', requestParams, scimBodyParams});
		}
    
		// Execute the queue.
		if (this.completedChanges >= this.expectedChanges) {
			await this.executeQueue();
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
    this.completedChanges ++;

		if (scimBodyParams) {
			// Now, create the `scim_configuration` for newly created `connection`.
			this.updateQueue.push({action: 'create', requestParams: {id: created.id}, scimBodyParams});
		}

		// Execute the queue.
		if (this.completedChanges >= this.expectedChanges) {
			await this.executeQueue();
		}

		// Return response from connections.create(...). 
		return created;
	}

	/**
	 * If we perform `connectionsManager.update` and `updateScimConfiguration` together, they may result in rate limit error.
	 * The reason is that both of them make API requests to the same `api/v2/connections` endpoint.
	 * We cannot control it with delay because both `updateOverride` and `createOverride` are async functions. And being called concurrently by `PromisePoolExecutor`.
	 * To avoid this, we are queuing the `SCIM` actions and executing them one by one separately, only after `connectionsManager.update` is completed.
	 * 
	 * This is true for both `create` and `update` actions.
	 * @returns {Promise<void>}
	 */
  async executeQueue() {
    if (this.isExecuting) return;

		this.isExecuting = true;
    while (this.updateQueue.length > 0) {
      // Rate limit error handling
      await sleep(250);
      const { action, requestParams, scimBodyParams } = this.updateQueue.shift();

      switch (action) {
        case 'create':
					if (this.scimScopes.create) await this.createScimConfiguration(requestParams, scimBodyParams);
          break;
        case 'update':
          if (this.scimScopes.update) await this.updateScimConfiguration(requestParams, scimBodyParams);
          break;
        case 'delete':
          if (this.scimScopes.delete) await this.deleteScimConfiguration(requestParams);
          break;
      }
    }

    this.isExecuting = false;
		this.expectedChanges = 0;
		this.completedChanges = 0;
  }
}

