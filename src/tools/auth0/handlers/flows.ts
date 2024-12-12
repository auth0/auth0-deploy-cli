import _, { isArray } from 'lodash';
import {
  GetFlows200ResponseOneOfInner,
  GetFlowsVaultConnections200ResponseOneOfInner,
} from 'auth0';
import dotProp from 'dot-prop';
import DefaultHandler, { order } from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';
import { findKeyPathWithValue } from '../../../utils';

export type Flow = {
  name: string;
  body: string;
};

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['name'],
  },
  additionalProperties: false,
};

export default class FlowHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'flows',
      id: 'id',
    });
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const [flows, allFlowConnections] = await Promise.all([
      paginate<GetFlows200ResponseOneOfInner>(this.client.flows.getAll, {
        paginate: true,
        include_totals: true,
      }),
      this.getAllFlowConnections(),
    ]);

    const allFlows = await Promise.all(
      flows.map(async (f) => {
        const { data: flow } = await this.client.flows.get({ id: f.id });
        return flow;
      })
    );

    // create a map for id to name from allFlowConnections
    const connectionIdMap = {};
    allFlowConnections.forEach((c) => {
      connectionIdMap[c.id] = c.name;
    });

    this.existing = await this.formateFlowConnectionId(allFlows, connectionIdMap);
    return this.existing;
  }

  @order('60')
  async processChanges(assets: Assets): Promise<void> {
    const { flows } = assets;

    // Do nothing if not set
    if (!flows) return;

    const allFlowConnections = await this.getAllFlowConnections();

    // create a map for name to id from allFlowConnections
    const connectionNameMap = {};
    allFlowConnections.forEach((c) => {
      connectionNameMap[c.name] = c.id;
    });

    assets.flows = await this.pargeFlowConnectionName(flows, connectionNameMap);

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    const changes: CalculatedChanges = {
      del: del,
      update: update,
      create: create,
      conflicts: conflicts,
    };

    await super.processChanges(assets, {
      ...changes,
    });
  }

  async getAllFlowConnections(): Promise<GetFlowsVaultConnections200ResponseOneOfInner[]> {
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

    return allFlowConnections;
  }

  async formateFlowConnectionId(flows, connectionIdMap): Promise<Asset> {
    // replace connection_id with flow connection names
    await Promise.all(
      flows.map(async (flow) => {
        const flowConnetions = findKeyPathWithValue(flow, 'connection_id');
        await Promise.all(
          flowConnetions.map(async (f) => {
            const connectionId = (dotProp.get(flow, f.path) || '') as string;
            const flowConnectionName = connectionIdMap[connectionId];
            if (!flowConnectionName) {
              log.warn(
                `Flow connection: ${connectionId} not found for flow:${flow.name}, please verify the flow connection id.`
              );
            } else {
              dotProp.set(flow, f.path, flowConnectionName);
            }
          })
        );
        return flow;
      })
    );

    return flows;
  }

  async pargeFlowConnectionName(flows, connectionNameMap): Promise<Flow[]> {
    // replace connection_id with flow connection names
    const parsedFlows = await Promise.all(
      flows.map(async (flow) => {
        const flowConnetions = findKeyPathWithValue(flow, 'connection_id');
        await Promise.all(
          flowConnetions.map(async (f) => {
            const connectionName = (dotProp.get(flow, f.path) || '') as string;
            const flowConnectionId = connectionNameMap[connectionName];
            if (!flowConnectionId) {
              log.error(
                `Flow connection: ${flowConnectionId} not found for flow:${flow.name}, please verify the flow connection name.`
              );
            } else {
              dotProp.set(flow, f.path, flowConnectionId);
            }
          })
        );
        return flow;
      })
    );

    return parsedFlows;
  }
}
