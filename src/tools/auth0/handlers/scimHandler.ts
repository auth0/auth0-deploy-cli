import { Asset } from '../../../types';
import axios, { AxiosResponse } from 'axios';

interface IdMapValue {
  strategy: string;
  hasConfig: boolean;
}

interface scimRequestParams {
	id: string;
}

interface scimBodyParams {
	user_id_attribute: string;
	mapping: { scim: string; auth0: string; }[];
}

/**
 * The current version of this sdk use `node-auth0` v3. But `SCIM` features are not natively supported by v3.
 * This is a workaround to make this SDK support SCIM without `node-auth0` upgrade.
 */
export default class ScimHandler {
	private idMap: Map<string, IdMapValue>;
	private readonly scimStrategies = ['samlp', 'oidc', 'okta', 'waad'];
	private tokenProvider: any;
	private config: any;
	connectionsManager: any;
    
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

		await Promise.all(
			connections.map(async (connection) => {
				if (this.isScimStrategy(connection.strategy)) {
					this.idMap.set(connection.id, { strategy: connection.strategy, hasConfig: false });
					try {
						await this.getScimConfiguration({ id: connection.id });
						this.idMap.set(connection.id, { ...this.idMap.get(connection.id)!, hasConfig: true });
					} catch (err) {
						if (!err.response || +err.response.status !== 404) throw err;
					}
				}

				return connection;
			})
		)
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
		await Promise.all(connections.map(async (connection) => {
      if (this.isScimStrategy(connection.strategy)) {
        try {
          const { user_id_attribute, mapping } = await this.getScimConfiguration({ id: connection.id });
          connection.scim_configuration = { user_id_attribute, mapping }
        } catch (err) {
					// Skip the connection if it returns 404. This can happen if `SCIM` is not enabled on a `SCIM` connection. 
          if (!err.response || +err.response.status !== 404) throw err;
        }
      }

      return connection;
    }));
	}

	/** 
	 * HTTP request wrapper on axios.
	 */
	private async scimHttpRequest(method: string, options: [string, ...Record<string, any>[]]): Promise<AxiosResponse> {
		// @ts-ignore
		const accessToken = await this.tokenProvider.getAccessToken();
		const headers = { 
			'Accept': 'application/json',
			'Authorization': `Bearer ${ accessToken }`
		}
		options = [...options, { headers }];
		return await axios[method](...options);
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
		const url = this.getScimEndpoint(connection_id);
		return await this.scimHttpRequest('post', [ url, { user_id_attribute, mapping } ]);
	}

	/**
	 * Retrieves `SCIM` configuration of an enterprise connection.
	 */
	async getScimConfiguration({ id: connection_id }: scimRequestParams): Promise<scimBodyParams> {
		const url = this.getScimEndpoint(connection_id);
		return (await this.scimHttpRequest('get', [ url ])).data;
	}

	/**
	 * Updates an existing `SCIM` configuration.
	 */
	async updateScimConfiguration({ id: connection_id }: scimRequestParams, { user_id_attribute, mapping }: scimBodyParams): Promise<AxiosResponse> {
		const url = this.getScimEndpoint(connection_id);
		return await this.scimHttpRequest('patch', [ url, { user_id_attribute, mapping } ]);
	}

	/**
	 * Deletes an existing `SCIM` configuration.
	 */
	async deleteScimConfiguration({ id: connection_id }: scimRequestParams): Promise<AxiosResponse>  {
		const url = this.getScimEndpoint(connection_id);
		return await this.scimHttpRequest('delete', [ url ]);
	}
  
	async updateOverride(requestParams: scimRequestParams, bodyParams: Asset) {
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
		if (idMapEntry?.hasConfig) {
			if (scimBodyParams) {
				await this.updateScimConfiguration(requestParams, scimBodyParams);
			} else {
				await this.deleteScimConfiguration(requestParams);
			}
		} else if (scimBodyParams) {
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
		if (scimBodyParams) {
			// Now, create the `scim_configuration` for newly created `connection`.
			await this.createScimConfiguration({ id: created.id }, scimBodyParams);
		}

		// Return response from connections.create(...). 
		return created;
	}
}