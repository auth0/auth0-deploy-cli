import _ from 'lodash';
import DefaultHandler, { order } from './default';
import { calculateChanges } from '../../calculateChanges';
import log from '../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      display_name: { type: 'string' },
      branding: { type: 'object' },
      metadata: { type: 'object' },
      connections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            connection_id: { type: 'string' },
            assign_membership_on_login: { type: 'boolean' }
          }
        }
      }
    },
    required: ['name']
  }
};

export default class OrganizationsHandler extends DefaultHandler {
  existing: Asset[]

  constructor(config: DefaultHandler) {
    super({
      ...config,
      type: 'organizations',
      id: 'id',
      identifiers: ['name']
    });
  }

  async deleteOrganization(org): Promise<void> {
    await this.client.organizations.delete({ id: org.id });
  }

  async deleteOrganizations(data): Promise<void> {
    if (this.config('AUTH0_ALLOW_DELETE') === 'true' || this.config('AUTH0_ALLOW_DELETE') === true) {
      await this.client.pool.addEachTask({
        data: data || [],
        generator: (item) => this.deleteOrganization(item).then(() => {
          this.didDelete(item);
          this.deleted += 1;
        }).catch((err) => {
          throw new Error(`Problem deleting ${this.type} ${this.objString(item)}\n${err}`);
        })
      }).promise();
    } else {
      log.warn(`Detected the following organizations should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${data.map((i) => this.objString(i)).join('\n')}`);
    }
  }

  async createOrganization(org): Promise<Asset> {
    const organization = { ...org };
    delete organization.connections;

    const created = await this.client.organizations.create(organization);

    if (typeof org.connections !== 'undefined' && org.connections.length > 0) {
      await Promise.all(org.connections.map((conn) => this.client.organizations.addEnabledConnection({ id: created.id }, conn)));
    }

    return created;
  }

  async createOrganizations(creates: CalculatedChanges['create']) {
    await this.client.pool.addEachTask({
      data: creates || [],
      generator: (item) => this.createOrganization(item).then((data) => {
        this.didCreate(data);
        this.created += 1;
      }).catch((err) => {
        throw new Error(`Problem creating ${this.type} ${this.objString(item)}\n${err}`);
      })
    }).promise();
  }

  async updateOrganization(org, organizations) {
    const { connections: existingConnections } = await organizations.find((orgToUpdate) => orgToUpdate.name === org.name);

    const params = { id: org.id };
    const { connections } = org;

    delete org.connections;
    delete org.name;
    delete org.id;

    await this.client.organizations.update(params, org);

    const connectionsToRemove = existingConnections.filter((c) => !connections.find((x) => x.connection_id === c.connection_id));
    const connectionsToAdd = connections.filter((c) => !existingConnections.find((x) => x.connection_id === c.connection_id));
    const connectionsToUpdate = connections.filter((c) => existingConnections.find((x) => x.connection_id === c.connection_id && x.assign_membership_on_login !== c.assign_membership_on_login));

    // Handle updates first
    await Promise.all(connectionsToUpdate.map((conn) => this.client.organizations
      .updateEnabledConnection({ connection_id: conn.connection_id, ...params }, { assign_membership_on_login: conn.assign_membership_on_login })
      .catch(() => {
        throw new Error(`Problem updating Enabled Connection ${conn.connection_id} for organizations ${params.id}`);
      })));

    await Promise.all(connectionsToAdd.map((conn) => this.client.organizations
      .addEnabledConnection(params, _.omit(conn, 'connection'))
      .catch(() => {
        throw new Error(`Problem adding Enabled Connection ${conn.connection_id} for organizations ${params.id}`);
      })));

    await Promise.all(connectionsToRemove.map((conn) => this.client.organizations
      .removeEnabledConnection({ connection_id: conn.connection_id, ...params })
      .catch(() => {
        throw new Error(`Problem removing Enabled Connection ${conn.connection_id} for organizations ${params.id}`);
      })));

    return params;
  }

  async updateOrganizations(updates: CalculatedChanges['update'], orgs: Asset[]): Promise<void>{
    await this.client.pool.addEachTask({
      data: updates || [],
      generator: (item) => this.updateOrganization(item, orgs).then((data) => {
        this.didUpdate(data);
        this.updated += 1;
      }).catch((err) => {
        throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
      })
    }).promise();
  }

  async getType(): Promise<Asset[]> {
    if (this.existing) {
      return this.existing;
    }

    if (!this.client.organizations || typeof this.client.organizations.getAll !== 'function') {
      return [];
    }

    try {
      const organizations = await this.client.organizations.getAll({ checkpoint: true, include_totals: true });
      for (let index = 0; index < organizations.length; index++) {
        const connections = await this.client.organizations.connections.get({ id: organizations[index].id });
        organizations[index].connections = connections;
      }
      this.existing = organizations;
      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return [];
      }
      throw err;
    }
  }

  // Run after connections
  @order('70')
  async processChanges(assets: Assets): Promise<void> {
    const { organizations } = assets;
    // Do nothing if not set
    if (!organizations) return;
    // Gets organizations from destination tenant
    const existing = await this.getType();
    const existingConnections = await this.client.connections.getAll({ paginate: true, include_totals: true });

    // We need to get the connection ids for the names configured so we can link them together
    organizations.forEach((org) => {
      org.connections = (org.connections || []).map((connection) => {
        const { name } = connection;
        delete connection.name;

        return {
          ...connection,
          connection_id: (existingConnections.find((c) => c.name === name) || {}).id
        };
      }).filter((connection) => !!connection.connection_id);
    });

    const changes = calculateChanges({
      handler: this,
      assets: organizations,
      existing,
      identifiers: ['id', 'name'],
      allowDelete: false //TODO: actually pass in correct allowDelete value
    });

    log.debug(`Start processChanges for organizations [delete:${changes.del.length}] [update:${changes.update.length}], [create:${changes.create.length}]`);

    const myChanges = [{ del: changes.del }, { create: changes.create }, { update: changes.update }];

    await Promise.all(myChanges.map(async (change) => {
      switch (true) {
        case change.del && change.del.length > 0:
          await this.deleteOrganizations(change.del);
          break;
        case change.create && change.create.length > 0:
          await this.createOrganizations(changes.create);
          break;
        case change.update && change.update.length > 0:
          //@ts-ignore because change.update cannot be undefined here
          await this.updateOrganizations(change.update, existing);
          break;
        default:
          break;
      }
    }));
  }
}
