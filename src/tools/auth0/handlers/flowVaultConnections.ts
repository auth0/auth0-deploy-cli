import { GetFlowsVaultConnections200ResponseOneOfInner } from 'auth0';
import { isArray } from 'lodash';
import DefaultHandler from './default';
import { Asset, Assets } from '../../../types';
import constants from '../../constants';

export type FlowVaultConnection = {
  name: string;
  app_id: string;
  environment: string;
  setup: object;
  account_name: string;
  ready: string;
};

export const schema = {
  type: 'object',
  items: {
    type: 'array',
    properties: {
      connections: {
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            app_id: { type: 'string', enum: constants.CONNECTION_APP_ID },
            environment: { type: 'string' },
            setup: { type: 'object' },
            account_name: { type: 'string' },
            ready: { type: 'string' },
          },
        },
        required: ['name', 'app_id'],
      },
    },
  },
  required: ['connections'],
};

export default class FlowVaultHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'flowVaultConnections',
      id: 'id',
      stripCreateFields: ['created_at', 'updated_at', 'refreshed_at', 'fingerprint'],
      stripUpdateFields: ['created_at', 'updated_at', 'refreshed_at', 'fingerprint'],
    });
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const allFlowConnections: GetFlowsVaultConnections200ResponseOneOfInner[] = [];
    // paginate without paginate<T> helper as this is not getAll but getAllConnections
    // paginate through all flow connections
    let page = 0;
    while (true) {
      const {
        data: { connections, total },
      } = await this.client.flows.getAllConnections({
        page: page,
        per_page: 100,
        include_totals: true,
      });

      // if we get an unexpected response, break the loop to avoid infinite loop
      if (!isArray(allFlowConnections) || typeof total !== 'number') {
        break;
      }

      allFlowConnections.push(...connections);
      page += 1;

      if (allFlowConnections.length === total) {
        break;
      }
    }

    this.existing =  allFlowConnections;

    return this.existing;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { flowVaultConnections } = assets;

    // Do nothing if not set
    if (!flowVaultConnections) return;

    const { del, update, create, conflicts } = await this.calcChanges(assets);
    console.log('processChanges', del, update, create, conflicts);
  }
}
