import DefaultAPIHandler, { order } from './default';
import log from '../../../logger';
import { Asset, Assets } from '../../../types';
import { paginate } from '../client';
import { Management } from 'auth0';

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'code'],
    additionalProperties: true,
    properties: {
      name: { type: 'string' },
      code: { type: 'string' },
      dependencies: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
          },
        },
      },
      secrets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['name'],
        },
      },
      all_changes_published: { type: 'boolean' },
    },
  },
};

export type ActionModule = Management.ActionModuleListItem;

export default class ActionModulesHandler extends DefaultAPIHandler {
  existing: ActionModule[] | null;

  constructor(options: DefaultAPIHandler) {
    super({
      ...options,
      type: 'actionModules',
      id: 'id',
      identifiers: ['id', 'name'],
      stripUpdateFields: [
        'name',
        'actions_using_module_total',
        'all_changes_published',
        'latest_version_number',
        'created_at',
        'updated_at',
      ],
      stripCreateFields: [
        'actions_using_module_total',
        'latest_version_number',
        'created_at',
        'updated_at',
      ],
      functions: {
        create: (module) => this.createModule(module),
        update: (id: string, module) => this.updateModule(id, module),
        delete: (id) => this.deleteModule(id),
      },
    });
  }

  async createModule(module: Management.CreateActionModuleRequestContent) {
    if ('all_changes_published' in module) {
      delete module.all_changes_published;
    }
    const createdModule = await this.client.actions.modules.create(module);

    return createdModule;
  }

  async updateModule(moduleId: string, module: Management.UpdateActionModuleRequestContent) {
    const updatableModule: Management.UpdateActionModuleRequestContent = {
      code: module.code,
      dependencies: module.dependencies,
      secrets: module.secrets,
    };
    return this.client.actions.modules.update(moduleId, updatableModule);
  }

  async deleteModule(moduleId: string) {
    return this.client.actions.modules.delete(moduleId);
  }

  objString(module: ActionModule): string {
    return super.objString({ id: module.id, name: module.name });
  }

  async publishActionModules(modules: ActionModule[]) {
    await this.client.pool
      .addEachTask({
        data: modules || [],
        generator: (module) =>
          this.client.actions.modules.versions
            .create(module.id!)
            .then(() => {
              log.info(`Published [${this.type}]: ${this.objString(module)}`);
            })
            .catch((err) => {
              throw new Error(`Problem Publishing ${this.type} ${this.objString(module)}\n${err}`);
            }),
      })
      .promise();
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;

    try {
      const modules = await paginate<ActionModule>(this.client.actions.modules.list, {
        paginate: true,
      });

      this.existing = modules;
      return this.existing;
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }

      if (err.statusCode === 403 || err.errorCode === 'feature_not_enabled') {
        log.debug('Skipping action modules because it is not enabled.');
        return null;
      }

      throw err;
    }
  }

  // Before actions are processed
  @order('50')
  async processChanges(assets: Assets): Promise<void> {
    const { actionModules } = assets;

    // Do nothing if not set
    if (!actionModules) return;

    const changes = await this.calcChanges(assets);
    await super.processChanges(assets, changes);

    // Refresh module list to get latest state with all_changes_published field
    const postProcessedModules = await (async () => {
      this.existing = null; // Clear the cache
      return this.getType();
    })();

    // Publish modules that have unpublished changes
    const modulesToPublish = [
      ...changes.create
        .filter((module) => module.all_changes_published === true)
        .map((moduleWithoutId) => {
          // Add IDs to just-created modules
          const moduleId = postProcessedModules?.find(
            (postProcessedModule) => postProcessedModule.name === moduleWithoutId.name
          )?.id;

          const module = postProcessedModules?.find(
            (postProcessedModule) => postProcessedModule.id === moduleId
          );

          return module;
        }),
      ...changes.update.filter((module) => module.all_changes_published === true),
    ].filter((module): module is ActionModule => module !== undefined);

    await this.publishActionModules(modulesToPublish);
  }
}
