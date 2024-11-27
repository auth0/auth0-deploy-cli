import _ from 'lodash';
import DefaultHandler, { order } from './default';
import constants from '../../constants';
import log from '../../../logger';
import { Assets } from '../../../types';
import { sleep } from '../../utils';

export const schema = {
  type: 'object',
  items: {
    type: 'object',
    additionalProperties: true,
    properties: {
      trigger_id: {
        type: 'object',
        properties: {
          action_name: { type: 'string', enum: constants.ACTIONS_TRIGGERS },
          display_name: { type: 'string', default: '' },
        },
      },
    },
  },
};

function isActionsDisabled(err): boolean {
  const errorBody = _.get(err, 'originalError.response.body') || {};

  return err.statusCode === 403 && errorBody.errorCode === 'feature_not_enabled';
}

export default class TriggersHandler extends DefaultHandler {
  existing: {
    [key: string]: {
      action_name: string;
      display_name: string;
    };
  };

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'triggers',
      id: 'name',
    });
  }

  async getType(): Promise<DefaultHandler['existing']> {
    if (this.existing) {
      return this.existing;
    }

    // in case client version does not support actions
    if (!this.client.actions || typeof this.client.actions.getAllTriggers !== 'function') {
      return [];
    }

    const triggerBindings = {};

    try {
      const res = await this.client.actions.getAllTriggers();
      const triggers: string[] = _(res.data.triggers).map('id').uniq().value();
      let triggerId;

      for (let i = 0; i < triggers.length; i++) {
        triggerId = triggers[i];
        const { data } = await this.client.actions.getTriggerBindings({
          triggerId: triggerId,
        });
        const { bindings } = data;
        if (bindings && bindings.length > 0) {
          triggerBindings[triggerId] = bindings.map((binding) => ({
            action_name: binding.action.name,
            display_name: binding.display_name,
          }));
        }
      }

      this.existing = triggerBindings;
      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return [];
      }

      if (isActionsDisabled(err)) {
        log.info('Skipping triggers because Actions is not enabled.');
        return {};
      }

      if (err.message === "cannot list action bindings for an entity-bound trigger") {
          log.warn(`${err.message.charAt(0).toUpperCase()}${err.message.slice(1)} (${triggerId})`);
          return {};
      }

      throw err;
    }
  }

  @order('80')
  async processChanges(assets: Assets): Promise<void> {
    // No API to delete or create triggers, we can only update.
    const { triggers } = assets;

    // Do nothing if not set
    if (!triggers) return;

    await sleep(2000); // Delay to allow newly-deployed actions to register in backend

    await Promise.all(
      Object.entries(triggers).map(async ([name, data]) => {
        const bindings = data.map((binding) => ({
          ref: {
            type: 'action_name',
            value: binding.action_name,
          },
          display_name: binding.display_name,
        }));

        await this.client.actions.updateTriggerBindings({ triggerId: name }, { bindings });
        this.didUpdate({ trigger_id: name });
        this.updated += 1;
      })
    );
  }
}
