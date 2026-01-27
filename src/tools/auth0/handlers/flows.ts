import { isEmpty } from 'lodash';
import { Management } from 'auth0';
import dotProp from 'dot-prop';
import DefaultHandler, { order } from './default';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';
import { findKeyPathWithValue } from '../../../utils';
import { getAllFlowConnections } from './flowVaultConnections';

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

  async getFlows(
    flows: Array<Management.FlowSummary>
  ): Promise<Management.GetFlowResponseContent[]> {
    const allFlows = await this.client.pool
      .addEachTask({
        data: flows,
        generator: ({ id }) =>
          this.client.flows.get(id).then((response) => {
            if (isEmpty(response)) return null;
            return response;
          }),
      })
      .promise();

    return allFlows.filter((flow): flow is Management.GetFlowResponseContent => flow !== null);
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    const [flows, allFlowConnections] = await Promise.all([
      paginate<Management.FlowSummary>(this.client.flows.list, {
        paginate: true,
      }),
      getAllFlowConnections(this.client),
    ]);

    // get more details for each flows
    const allFlows = await this.getFlows(flows);

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

    const allFlowConnections = await getAllFlowConnections(this.client);

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
