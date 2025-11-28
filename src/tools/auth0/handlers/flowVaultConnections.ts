import { Management } from 'auth0';
import { isEmpty } from 'lodash';
import DefaultHandler, { order } from './default';
import { Asset, Assets, Auth0APIClient, CalculatedChanges } from '../../../types';
import constants from '../../constants';
import log from '../../../logger';

export type FlowVaultConnection = Management.GetFlowsVaultConnectionResponseContent;

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      app_id: { type: 'string', enum: constants.CONNECTION_APP_ID },
      environment: { type: 'string' },
      setup: { type: 'object' },
      account_name: { type: 'string' },
      ready: { type: 'boolean' },
    },
    required: ['name', 'app_id'],
  },
  additionalProperties: false,
};

export const getAllFlowConnections = async (
  auth0Client: Auth0APIClient
): Promise<Management.FlowsVaultConnectionSummary[]> => {
  const allFlowConnections: Management.FlowsVaultConnectionSummary[] = [];

  let vaultConnections = await auth0Client.flows.vault.connections.list();
  do {
    allFlowConnections.push(...vaultConnections.data);
    vaultConnections = await vaultConnections.getNextPage();
  } while (vaultConnections.hasNextPage());

  return allFlowConnections;
};

export default class FlowVaultHandler extends DefaultHandler {
  existing: Asset;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'flowVaultConnections',
      id: 'id',
      stripCreateFields: ['created_at', 'updated_at', 'refreshed_at', 'fingerprint', 'ready'],
      stripUpdateFields: ['created_at', 'updated_at', 'refreshed_at', 'fingerprint', 'ready'],
    });
  }

  objString(item): string {
    return super.objString({ id: item.id, name: item.name });
  }

  async getType(): Promise<Asset> {
    if (this.existing) {
      return this.existing;
    }

    this.existing = await getAllFlowConnections(this.client);

    return this.existing;
  }

  @order('70')
  async processChanges(assets: Assets): Promise<void> {
    const { flowVaultConnections } = assets;

    // Do nothing if not set
    if (!flowVaultConnections) return;

    const { del, update, create } = await this.calcChanges(assets);

    log.debug(
      `Start processChanges for flow vault connections [delete:${del.length}] [update:${update.length}], [create:${create.length}]`
    );

    const changes = [{ del: del }, { create: create }, { update: update }];

    await Promise.all(
      changes.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            await this.deleteVaultConnections(change.del || []);
            break;
          case change.create && change.create.length > 0:
            await this.createVaultConnections(change.create);
            break;
          case change.update && change.update.length > 0:
            if (change.update) await this.updateVaultConnections(change.update);
            break;
          default:
            break;
        }
      })
    );
  }

  async createVaultConnection(conn): Promise<Asset> {
    if ('ready' in conn) {
      delete conn.ready;
    }
    if ('account_name' in conn) {
      delete conn.account_name;
    }
    const created = await this.client.flows.vault.connections.create(conn);
    return created;
  }

  async createVaultConnections(creates: CalculatedChanges['create']) {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item) =>
          this.createVaultConnection(item)
            .then((data) => {
              this.didCreate(data);
              this.created += 1;
            })
            .catch((err) => {
              throw new Error(`Problem creating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async updateVaultConnection(conn) {
    const { id, name, setup } = conn;
    const params: Management.UpdateFlowsVaultConnectionRequestContent = {
      name,
    };
    if (!isEmpty(setup)) {
      params.setup = setup;
    }
    const updated = await this.client.flows.vault.connections.update(id, params);
    return updated;
  }

  async updateVaultConnections(updates: CalculatedChanges['update']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item) =>
          this.updateVaultConnection(item)
            .then((data) => {
              this.didUpdate(data);
              this.updated += 1;
            })
            .catch((err) => {
              throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async deleteVaultConnection(conn): Promise<void> {
    await this.client.flows.vault.connections.delete(conn.id);
  }

  async deleteVaultConnections(data: Asset[]): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: data || [],
          generator: (item) =>
            this.deleteVaultConnection(item)
              .then(() => {
                this.didDelete(item);
                this.deleted += 1;
              })
              .catch((err) => {
                throw new Error(`Problem deleting ${this.type} ${this.objString(item)}\n${err}`);
              }),
        })
        .promise();
    } else {
      log.warn(`Detected the following flow vault connection should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${data.map((i) => this.objString(i)).join('\n')}`);
    }
  }
}
