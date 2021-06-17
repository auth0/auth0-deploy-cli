import DefaultHandler, { order } from './default';
import constants from '../../constants';

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

export default class TriggersHandler extends DefaultHandler {
  constructor(options) {
    super({
      ...options,
      type: 'triggers',
      id: 'name'
    });
  }

  async getType() {
    if (this.existing) return this.existing;

    if (!this.client.actions || typeof this.client.actions.getTriggerBindings !== 'function') {
      return [];
    }

    try {
      this.existing = await constants.ACTIONS_TRIGGERS.reduce(async (triggers, name) => {
        const bindings = await this.client.actions.getTriggerBindings({ paginate: true, trigger_id: name });
        triggers[name] = bindings.map((binding) => ({
          action_name: binding.action.name,
          display_name: binding.display_name
        }));
        return triggers;
      }, {});

      return this.existing;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 501) {
        return [];
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
