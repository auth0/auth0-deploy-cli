import DefaultHandler, { order } from './default';
import constants from '../../constants';
import log from '../../logger';
import _ from 'lodash';

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
          display_name: { type: 'string', default: '' }
        }
      }
    }
  }
};

function isActionsDisabled(err) {
  const errorBody = _.get(err, 'originalError.response.body') || {};

  return (
    err.statusCode === 403 && errorBody.errorCode === 'feature_not_enabled'
  );
}
export default class TriggersHandler extends DefaultHandler {
  constructor(options) {
    super({
      ...options,
      type: 'triggers',
      id: 'name'
    });
  }

  async getType() {
    if (this.existing) {
      return this.existing;
    }

    // in case client version does not support actions
    if (
      !this.client.actions
      || typeof this.client.actions.getAllTriggers !== 'function'
    ) {
      return [];
    }

    const triggerBindings = {};

    try {
      const res = await this.client.actions.getAllTriggers();
      const triggers = _(res.triggers).map('id').uniq().value();

      for (let i = 0; i < triggers.length; i++) {
        const triggerId = triggers[i];
        const { bindings } = await this.client.actions.getTriggerBindings({
          trigger_id: triggerId
        });
        if (bindings.length > 0) {
          triggerBindings[triggerId] = bindings.map((binding) => ({
            action_name: binding.action.name,
            display_name: binding.display_name
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

      throw err;
    }

  }

  @order('80')
  async processChanges(assets) {
    // No API to delete or create triggers, we can only update.
    const { triggers } = assets;

    // Do nothing if not set
    if (!triggers) return;

    // Process each trigger
    await Promise.all(Object.entries(triggers).map(async ([ name, data ]) => {
      const bindings = data.map((binding) => ({
        ref: {
          type: 'action_name',
          value: binding.action_name
        },
        display_name: binding.display_name
      }));
      await this.client.actions.updateTriggerBindings({ trigger_id: name }, { bindings });
      this.didUpdate({ trigger_id: name });
      this.updated += 1;
    }));
  }
}
