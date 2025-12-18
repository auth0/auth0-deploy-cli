import { Management } from 'auth0';
import DefaultHandler, { order } from './default';
import { calculateChanges } from '../../calculateChanges';
import log from '../../../logger';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';

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

type Role = Management.GetRoleResponseContent;
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

    const created = await this.client.roles.create(role);

    if (created.id && typeof data.permissions !== 'undefined' && data.permissions.length > 0) {
      await this.client.roles.permissions.add(created.id, { permissions: data.permissions });
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
    await this.client.roles.delete(data.id);
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

    await this.client.roles.update(params.id, data);

    if (typeof existingRole.permissions !== 'undefined' && existingRole.permissions.length > 0) {
      await this.client.roles.permissions.delete(params.id, {
        permissions: existingRole.permissions,
      });
    }

    if (typeof newPermissions !== 'undefined' && newPermissions.length > 0) {
      await this.client.roles.permissions.add(params.id, { permissions: newPermissions });
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

    try {
      const roles = await paginate<Role>(this.client.roles.list, {
        paginate: true,
        include_totals: true,
      });

      for (let index = 0; index < roles.length; index++) {
        const allPermission: Management.PermissionsResponsePayload[] = [];
        /*
        let page = 0;
        while (true) {
          const {
            data: { permissions, total },
          } = await this.client.roles.permissions.list({
            include_totals: true,
            id: roles[index].id,
            page: page,
            per_page: 100,
          });

          allPermission.push(...permissions);
          page += 1;
          if (allPermission.length === total) {
            break;
          }
          // if we get an unexpected response, break the loop to avoid infinite loop
          if (!isArray(permissions) || typeof total !== 'number') {
            break;
          }
        }
        */

        const rolesId = roles[index].id as string;
        let permissions = await this.client.roles.permissions.list(rolesId, { per_page: 100 });
        do {
          allPermission.push(...permissions.data);
          permissions = await permissions.getNextPage();
        } while (permissions.hasNextPage());

        const strippedPerms = await Promise.all(
          allPermission.map(async (permission) => {
            delete permission.resource_server_name;
            delete permission.description;
            return permission;
          })
        );

        (roles[index] as any).permissions = strippedPerms;
      }
      this.existing = roles;
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
    if (changes.del.length > 0) {
      await this.deleteRoles(changes.del);
    }

    if (changes.create.length > 0) {
      await this.createRoles(changes.create);
    }

    if (changes.update.length > 0) {
      await this.updateRoles(changes.update, existing);
    }
  }
}
