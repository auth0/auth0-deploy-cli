import { isArray, isEmpty } from 'lodash';
import {
  GetFlows200ResponseOneOfInner,
  GetFlowsVaultConnections200ResponseOneOfInner,
  PostFlows201Response,
} from 'auth0';
import dotProp from 'dot-prop';
import DefaultHandler, { order } from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';
import { findKeyPathWithValue } from '../../../utils';
import { isDryRun } from '../../utils';

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
      stripCreateFields: ['created_at', 'updated_at', 'executed_at'],
      stripUpdateFields: ['created_at', 'updated_at', 'executed_at'],
    });
  }

  objString(item): string {
    return super.objString({ id: item.id, name: item.name });
  }

  async getFlows(flows: Array<GetFlows200ResponseOneOfInner>): Promise<PostFlows201Response[]> {
    const allFlows = await this.client.pool
      .addEachTask({
        data: flows,
        generator: ({ id }) =>
          this.client.flows.get({ id: id }).then((response) => {
            if (isEmpty(response?.data)) return null;
            return response.data;
          }),
      })
      .promise();

    return allFlows.filter((flow): flow is PostFlows201Response => flow !== null);
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

    // get more details for each flows
    const allFlows: Array<PostFlows201Response> = await this.getFlows(flows);

    // create a map for id to name from allFlowConnections
    const connectionIdMap = {};
    allFlowConnections.forEach((c) => {
      connectionIdMap[c.id] = c.name;
    });

    this.existing = await this.formateFlowConnectionId(allFlows, connectionIdMap);
    return this.existing;
  }

  @order('80')
  async processChanges(assets: Assets): Promise<void> {
    const { flows } = assets;

    // Do nothing if not set
    if (!flows) return;

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    if (isDryRun(this.config)) {
      if (
        create.length === 0 &&
        update.length === 0 &&
        del.length === 0 &&
        conflicts.length === 0
      ) {
        return;
      }
    }

    const allFlowConnections = await this.getAllFlowConnections();

    // create a map for name to id from allFlowConnections
    const connectionNameMap = {};
    allFlowConnections.forEach((c) => {
      connectionNameMap[c.name] = c.id;
    });

    const changes: CalculatedChanges = {
      del: await this.pargeFlowConnectionName(del, connectionNameMap),
      update: await this.pargeFlowConnectionName(update, connectionNameMap),
      create: await this.pargeFlowConnectionName(create, connectionNameMap),
      conflicts: await this.pargeFlowConnectionName(conflicts, connectionNameMap),
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
