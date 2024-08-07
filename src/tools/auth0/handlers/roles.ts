import { GetOrganizationMemberRoles200ResponseOneOfInner } from 'auth0';
import DefaultHandler, { order } from './default';
import { calculateChanges } from '../../calculateChanges';
import log from '../../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      id: { type: 'string' },
      description: { type: 'string' },
      permissions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            permission_name: { type: 'string' },
            resource_server_identifier: { type: 'string' },
          },
        },
      },
    },
    required: ['name'],
  },
};

export default class RolesHandler extends DefaultHandler {
  existing: Asset[];

  constructor(config: DefaultHandler) {
    super({
      ...config,
      type: 'roles',
      id: 'id',
    });
  }

  async createRole(data): Promise<Asset> {
    const role = { ...data };
    delete role.permissions;

    const { data: created } = await this.client.roles.create(role);

    if (typeof data.permissions !== 'undefined' && data.permissions.length > 0) {
      await this.client.roles.addPermissions({ id: created.id }, { permissions: data.permissions });
    }

    return created;
  }

  async createRoles(creates: CalculatedChanges['create']): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item) =>
          this.createRole(item)
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

  async deleteRole(data) {
    await this.client.roles.delete({ id: data.id });
  }

  async deleteRoles(dels: CalculatedChanges['del']): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: dels || [],
          generator: (item) =>
            this.deleteRole(item)
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
      log.warn(`Detected the following roles should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${dels.map((i) => this.objString(i)).join('\n')}`);
    }
  }

  async updateRole(data, roles) {
    const existingRole = await roles.find(
      (roleDataForUpdate) => roleDataForUpdate.name === data.name
    );

    const params = { id: data.id };
    const newPermissions = data.permissions;

    delete data.permissions;
    delete data.id;

    await this.client.roles.update(params, data);

    if (typeof existingRole.permissions !== 'undefined' && existingRole.permissions.length > 0) {
      await this.client.roles.deletePermissions(params, { permissions: existingRole.permissions });
    }

    if (typeof newPermissions !== 'undefined' && newPermissions.length > 0) {
      await this.client.roles.addPermissions(params, { permissions: newPermissions });
    }

    return params;
  }

  async updateRoles(updates: CalculatedChanges['update'], roles) {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item) =>
          this.updateRole(item, roles)
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

  async getType() {
    if (this.existing) {
      return this.existing;
    }

    // in case client version does not support roles
    if (!this.client.roles || typeof this.client.roles.getAll !== 'function') {
      return [];
    }

    try {
      const allRoles: GetOrganizationMemberRoles200ResponseOneOfInner[] = [];
      let page: number = 0;
      // paginate through all roles
      while (true) {
        const {
          data: { roles, total },
        } = await this.client.roles.getAll({ include_totals: true, page: page });
        allRoles.push(...roles);
        page += 1;
        if (allRoles.length === total) {
          break;
        }
      }

      for (let index = 0; index < allRoles.length; index++) {
        // TODO: Bring back paginate: true
        const {
          data: { permissions },
        } = await this.client.roles.getPermissions({
          include_totals: true,
          id: allRoles[index].id,
        });
        const strippedPerms = await Promise.all(
          permissions.map(async (permission) => {
            delete permission.resource_server_name;
            delete permission.description;
            return permission;
          })
        );
        // TODO: Do we need this?
        (allRoles[index] as any).permissions = strippedPerms;
      }
      this.existing = allRoles;
      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return [];
      }
      throw err;
    }
  }

  @order('60')
  async processChanges(assets: Assets): Promise<void> {
    const { roles } = assets;
    // Do nothing if not set
    if (!roles) return;
    // Gets roles from destination tenant
    const existing = await this.getType();

    const changes = calculateChanges({
      handler: this,
      assets: roles,
      existing,
      identifiers: this.identifiers,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });
    log.debug(
      `Start processChanges for roles [delete:${changes.del.length}] [update:${changes.update.length}], [create:${changes.create.length}]`
    );
    const myChanges = [
      { del: changes.del },
      { create: changes.create },
      { update: changes.update },
    ];
    await Promise.all(
      myChanges.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            if (change.del) await this.deleteRoles(change.del);
            break;
          case change.create && change.create.length > 0:
            if (change.create) await this.createRoles(changes.create);
            break;
          case change.update && change.update.length > 0:
            if (change.update) await this.updateRoles(change.update, existing);
            break;
          default:
            break;
        }
      })
    );
  }
}
