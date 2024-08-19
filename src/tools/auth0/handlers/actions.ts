import _ from 'lodash';
import { GetActions200ResponseActionsInner, PostActionRequest } from 'auth0';
import DefaultAPIHandler, { order } from './default';
import log from '../../../logger';
import { areArraysEquals, sleep } from '../../utils';
import { Asset, Assets, CalculatedChanges } from '../../../types';

const MAX_ACTION_DEPLOY_RETRY_ATTEMPTS = 60; // 60 * 2s => 2 min timeout

export type Action = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deployed?: boolean;
  supported_triggers: {
    id: string;
    version: string;
    status?: string;
  }[];
  code?: string;
  dependencies?: [];
  runtime?: string;
  status?: string;
  secrets?: {
    name: string;
    value: string;
  }[];
  all_changes_deployed?: boolean;
  installed_integration_id?: string;
  integration?: Object;
};

// With this schema, we can only validate property types but not valid properties on per type basis
export const schema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'supported_triggers', 'code'],
    additionalProperties: false,
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
      deployed: { type: 'boolean' },
      status: { type: 'string' },
    },
  },
};

function isActionsDisabled(err) {
  const errorBody = _.get(err, 'originalError.response.body') || {};

  return err.statusCode === 403 && errorBody.errorCode === 'feature_not_enabled';
}

export function isMarketplaceAction(action: Action): boolean {
  return !!action.integration;
}

export default class ActionHandler extends DefaultAPIHandler {
  existing: GetActions200ResponseActionsInner[] | null;

  constructor(options: DefaultAPIHandler) {
    super({
      ...options,
      type: 'actions',
      functions: {
        create: (action: PostActionRequest) => this.createAction(action),
        delete: (action: Action) => this.deleteAction(action),
      },
      stripUpdateFields: ['deployed', 'status'],
    });
  }

  async createAction(action: PostActionRequest) {
    // Strip the deployed flag
    const addAction = { ...action };

    // TODO: Should we keep this?
    delete (addAction as any).deployed;
    delete (addAction as any).status;

    const { data: createdAction } = await this.client.actions.create(addAction);
    // Add the action id so we can deploy it later

    // TODO: Should we keep this?
    (action as any).id = createdAction.id;

    return createdAction;
  }

  async deleteAction(action: Action) {
    if (!this.client.actions || typeof this.client.actions.delete !== 'function') {
      return [];
    }
    return this.client.actions.delete({ id: action.id, force: true });
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
      await this.client.actions.deploy({ id: action.id });
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

    return actionChanges;
  }

  async getType(): Promise<Asset[] | null> {
    if (this.existing) return this.existing;

    if (!this.client.actions || typeof this.client.actions.getAll !== 'function') {
      return [];
    }
    // Actions API does not support include_totals param like the other paginate API's.
    // So we set it to false otherwise it will fail with "Additional properties not allowed: include_totals"
    try {
      const allActions: GetActions200ResponseActionsInner[] = [];
      let page: number = 0;
      // paginate through all actions
      while (true) {
        const {
          data: { actions, total },
        } = await await this.client.actions.getAll({ page: page });
        allActions.push(...actions);
        page += 1;
        if (allActions.length === total) {
          break;
        }
      }
      this.existing = allActions;
      return allActions;
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

  @order('60')
  async processChanges(assets: Assets) {
    const { actions } = assets;

    // Do nothing if not set
    if (!actions) return;
    const changes = await this.calcChanges(assets);

    //Management of marketplace actions not currently supported, see ESD-23225.
    const changesWithMarketplaceActionsFiltered: CalculatedChanges = (() => {
      return {
        ...changes,
        del: changes.del.filter((action: Action) => !isMarketplaceAction(action)),
      };
    })();

    await super.processChanges(assets, changesWithMarketplaceActionsFiltered);

    const postProcessedActions = await (async () => {
      this.existing = null; //Clear the cache
      const actions = await this.getType();
      return actions;
    })();

    // Deploy actions
    const deployActions = [
      ...changes.create
        .filter((action) => action.deployed)
        .map((actionWithoutId) => {
          // Add IDs to just-created actions
          const actionId = postProcessedActions?.find((postProcessedAction) => {
            return postProcessedAction.name === actionWithoutId.name;
          })?.id;

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
