import { get } from 'lodash';
import { Management } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import log from '../../../logger';
import { areArraysEquals, sleep } from '../../utils';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import { ActionModule } from './actionModules';

const MAX_ACTION_DEPLOY_RETRY_ATTEMPTS = 60; // 60 * 2s => 2 min timeout

export type Action = Management.Action & {
  deployed?: boolean;
};
type ActionCreate = Management.CreateActionRequestContent;

type CreateActionRequestWithId = ActionCreate & {
  id: string;
};

// With this schema, we can only validate property types but not valid properties on per type basis
export const schema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'supported_triggers', 'code'],
    additionalProperties: true,
    properties: {
      code: { type: 'string', default: '' },
      runtime: { type: 'string' },
      dependencies: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            registry_url: { type: 'string' },
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
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
      name: { type: 'string', default: '' },
      supported_triggers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', default: '' },
            version: { type: 'string' },
            url: { type: 'string' },
          },
        },
      },
      modules: {
        type: 'array',
        items: {
          type: 'object',
          required: ['module_name', 'module_version_number'],
          properties: {
            module_name: { type: 'string' },
            module_version_number: { type: 'number' },
          },
        },
      },
      deployed: { type: 'boolean' },
      status: { type: 'string' },
    },
  },
};

function isActionsDisabled(err) {
  const errorBody = get(err, 'originalError.response.body') || {};

  return err.statusCode === 403 && errorBody.errorCode === 'feature_not_enabled';
}

export function isMarketplaceAction(action: Action): boolean {
  return !!action.integration;
}

export default class ActionHandler extends DefaultAPIHandler {
  existing: Action[] | null;

  constructor(options: DefaultAPIHandler) {
    super({
      ...options,
      type: 'actions',
      functions: {
        create: (action: CreateActionRequestWithId) => this.createAction(action),
        update: (id: string, action: Management.UpdateActionRequestContent) =>
          this.updateAction(id, action),
        delete: (actionId: string) => this.deleteAction(actionId),
      },
      stripUpdateFields: ['deployed', 'status'],
    });
  }

  async createAction(action: CreateActionRequestWithId) {
    // Strip the deployed flag
    const addAction = { ...action };

    if ('deployed' in addAction) {
      delete addAction.deployed;
    }
    if ('status' in addAction) {
      delete addAction.status;
    }

    const createdAction = await this.client.actions.create(addAction);

    // Add the action id so we can deploy it later
    if (createdAction?.id) {
      action.id = createdAction.id;
    }

    return createdAction;
  }

  async updateAction(actionId: string, action: Management.UpdateActionRequestContent) {
    return this.client.actions.update(actionId, action);
  }

  async deleteAction(actionId: string) {
    if (!this.client.actions || typeof this.client.actions.delete !== 'function') {
      return [];
    }
    return this.client.actions.delete(actionId, { force: true });
  }

  objString(action) {
    return super.objString({ id: action.id, name: action.name });
  }

  async deployActions(actions) {
    await this.client.pool
      .addEachTask({
        data: actions || [],
        generator: (action) =>
          this.deployAction(action)
            .then(() => {
              log.info(`Deployed [${this.type}]: ${this.objString(action)}`);
            })
            .catch((err) => {
              throw new Error(`Problem Deploying ${this.type} ${this.objString(action)}\n${err}`);
            }),
      })
      .promise();
  }

  async deployAction(action) {
    try {
      await this.client.actions.deploy(action.id);
    } catch (err) {
      // Retry if pending build.
      if (err.message && err.message.includes("must be in the 'built' state")) {
        if (!action.retry_count) {
          log.info(`[${this.type}]: Waiting for build to complete ${this.objString(action)}`);
          action.retry_count = 1;
        }
        if (action.retry_count > MAX_ACTION_DEPLOY_RETRY_ATTEMPTS) {
          throw err;
        }
        await sleep(2000);
        action.retry_count += 1;
        await this.deployAction(action);
      } else {
        throw err;
      }
    }
  }

  async actionChanges(action, found) {
    const actionChanges: Asset = {};

    // if action is deployed, should compare against curren_version - calcDeployedVersionChanges method
    if (!action.deployed) {
      // name or secrets modifications are not supported yet
      if (action.code !== found.code) {
        actionChanges.code = action.code;
      }

      if (action.runtime !== found.runtime) {
        actionChanges.runtime = action.runtime;
      }

      if (!areArraysEquals(action.dependencies, found.dependencies)) {
        actionChanges.dependencies = action.dependencies;
      }
    }

    if (!areArraysEquals(action.supported_triggers, found.supported_triggers)) {
      actionChanges.supported_triggers = action.supported_triggers;
    }

    if (!areArraysEquals(action.modules, found.modules)) {
      actionChanges.modules = action.modules;
    }

    return actionChanges;
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;

    if (!this.client.actions || typeof this.client.actions.list !== 'function') {
      return [];
    }
    // Actions API does not support include_totals param like the other paginate API's.
    // So we set it to false otherwise it will fail with "Additional properties not allowed: include_totals"
    try {
      const actions = await paginate<Action>(this.client.actions.list, {
        paginate: true,
      });

      this.existing = actions;
      return actions;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return null;
      }

      if (err.statusCode === 500 && err.message === 'An internal server error occurred') {
        throw new Error(
          "Cannot process actions because the actions service is currently unavailable. Retrying may result in a successful operation. Alternatively, adding 'actions' to `AUTH0_EXCLUDED` configuration property will provide ability to skip until service is restored to actions service. This is not an issue with the Deploy CLI."
        );
      }

      if (isActionsDisabled(err)) {
        log.info('Skipping actions because it is not enabled.');
        return null;
      }

      throw err;
    }
  }

  async calcChanges(assets: Assets): Promise<CalculatedChanges> {
    let { actions, actionModules } = assets;

    // Do nothing if not set
    if (!actions)
      return {
        del: [],
        create: [],
        update: [],
        conflicts: [],
      };

    let modules: ActionModule[] | null = null;
    if (actionModules && actionModules.length > 0) {
      modules = actionModules;
    } else {
      try {
        modules = await paginate<ActionModule>(this.client.actions.modules.list, {
          paginate: true,
        });
      } catch {
        log.debug(
          'Skipping actions modules enrichment because action modules could not be retrieved.'
        );
        modules = null;
      }
    }

    if (modules != null) {
      // Use task queue to process actions in parallel
      const processedActions = await this.client.pool
        .addEachTask({
          data: actions || [],
          generator: (action) => this.enrichActionWithModuleIds(action, modules),
        })
        .promise();

      actions = processedActions;
    }

    return super.calcChanges({ ...assets, actions });
  }

  async enrichActionWithModuleIds(action: Action, modules: ActionModule[]): Promise<Action> {
    if (!action.modules || action.modules.length === 0) {
      return action;
    }

    const updatedModules = await this.client.pool
      .addEachTask({
        data: action.modules,
        generator: async (module) => {
          const foundModule = modules.find((m) => m.name === module.module_name);
          if (foundModule && foundModule.id) {
            // paginate to get all versions of the module
            const allModuleVersions: Management.ActionModuleVersion[] = [];
            let moduleVersions = await this.client.actions.modules.versions.list(foundModule.id);

            // Process first page
            allModuleVersions.push(...moduleVersions.data);

            // Fetch remaining pages
            while (moduleVersions.hasNextPage()) {
              moduleVersions = await moduleVersions.getNextPage();
              allModuleVersions.push(...moduleVersions.data);
            }

            return {
              module_name: module.module_name,
              module_id: foundModule.id,
              module_version_number: module.module_version_number,
              module_version_id:
                allModuleVersions?.find((v) => v.version_number === module.module_version_number)
                  ?.id || '',
            };
          }
          return module;
        },
      })
      .promise();

    return {
      ...action,
      modules: updatedModules,
    } as Action;
  }

  @order('51')
  async processChanges(assets: Assets) {
    const { actions } = assets;

    // Do nothing if not set
    if (!actions) return;

    const changes = await this.calcChanges(assets);

    // Management of marketplace actions not currently supported, see ESD-23225.
    const changesWithMarketplaceActionsFiltered: CalculatedChanges = (() => ({
      ...changes,
      del: changes.del.filter((action: Action) => !isMarketplaceAction(action)),
    }))();

    await super.processChanges(assets, changesWithMarketplaceActionsFiltered);

    const postProcessedActions = await (async () => {
      this.existing = null; // Clear the cache
      return this.getType();
    })();

    // Deploy actions
    const deployActions = [
      ...changes.create
        .filter((action) => action.deployed)
        .map((actionWithoutId) => {
          // Add IDs to just-created actions
          const actionId = postProcessedActions?.find(
            (postProcessedAction) => postProcessedAction.name === actionWithoutId.name
          )?.id;

          const actionWithId = {
            ...actionWithoutId,
            id: actionId,
          };
          return actionWithId;
        })
        .filter((action) => !!action.id),
      ...changes.update.filter((action) => action.deployed),
    ];

    await this.deployActions(deployActions);
  }
}
