import ValidationError from '../../ValidationError';
import {
  dumpJSON, calcChanges, stripFields, duplicateItems
} from '../../utils';
import DefaultHandler from './default';
import log from '../../logger';

export const excludeSchema = {
  type: 'array',
  items: { type: 'string' }
};

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    default: [],
    properties: {
      script: {
        type: 'string',
        description: 'A script that contains the rule\'s code',
        default: ''
      },
      name: {
        type: 'string',
        description: 'The name of the rule. Can only contain alphanumeric characters, spaces and \'-\'. Can neither start nor end with \'-\' or spaces',
        pattern: '^[^-\\s][a-zA-Z0-9-\\s]+[^-\\s]$'
      },
      order: {
        type: [ 'number', 'null' ],
        description: 'The rule\'s order in relation to other rules. A rule with a lower order than another rule executes first.',
        default: null
      },
      enabled: {
        type: 'boolean',
        description: 'true if the rule is enabled, false otherwise',
        default: true
      },
      stage: {
        type: 'string',
        description: 'The rule\'s execution stage',
        default: 'login_success',
        enum: [ 'login_success', 'login_failure', 'pre_authorize' ]
      }
    },
    required: [ 'name' ]
  }
};

export default class RulesHandler extends DefaultHandler {
  constructor(options) {
    super({
      ...options,
      type: 'rules',
      stripUpdateFields: [ 'stage' ] // Fields not allowed in updates
    });
  }

  async getType() {
    if (this.existing) return this.existing;
    this.existing = await this.client.rules.getAll({ paginate: true, include_totals: true });
    return this.existing;
  }

  objString(rule) {
    return super.objString({ name: rule.name, order: rule.order });
  }

  async calcChanges(assets, includeExcluded = false) {
    let { rules } = assets;

    const excludedRules = (assets.exclude && assets.exclude.rules) || [];

    let existing = await this.getType();

    // Filter excluded rules
    if (!includeExcluded) {
      rules = rules.filter((r) => !excludedRules.includes(r.name));
      existing = existing.filter((r) => !excludedRules.includes(r.name));
    }

    // Figure out what needs to be updated vs created
    const {
      del, update, create, conflicts
    } = calcChanges(this, rules, existing, [ 'id', 'name' ]);

    // Figure out the rules that need to be re-ordered
    const futureRules = [ ...create, ...update ];

    const futureMaxOrder = Math.max(...futureRules.map((r) => r.order));
    const existingMaxOrder = Math.max(...existing.map((r) => r.order));
    let nextOrderNo = Math.max(futureMaxOrder, existingMaxOrder);

    const reOrder = futureRules.reduce((accum, r) => {
      const conflict = existing.find((f) => r.order === f.order && r.name !== f.name);
      if (conflict) {
        nextOrderNo += 1;
        accum.push({
          ...conflict,
          order: nextOrderNo
        });
      }
      return accum;
    }, []);

    return {
      del,
      update,
      create,
      reOrder,
      conflicts
    };
  }

  async validate(assets) {
    const { rules } = assets;

    // Do nothing if not set
    if (!rules) return;

    const excludedRules = (assets.exclude && assets.exclude.rules) || [];

    // Figure out what needs to be updated vs created
    const { update, create, del } = await this.calcChanges(assets, true);
    // Include del rules which are actually not going to be deleted but are excluded
    // they can still muck up the ordering so we must take it into consideration.
    const futureRules = [ ...create, ...update, ...del.filter((r) => excludedRules.includes(r.name)) ];

    // Detect rules with the same order
    const rulesSameOrder = duplicateItems(futureRules, 'order');
    if (rulesSameOrder.length > 0) {
      const formatted = rulesSameOrder.map((dups) => dups.map((d) => `${d.name}`));
      throw new ValidationError(`There are multiple rules for the following stage-order combinations
      ${dumpJSON(formatted)}.
       Only one rule must be defined for the same order number in a stage.`);
    }

    // Detect Rules that are changing stage as it's not allowed.
    const existing = await this.getType();
    const stateChanged = futureRules.reduce((changed, rule) => ([
      ...changed,
      ...existing.filter((r) => rule.name.toLowerCase() === r.name.toLowerCase() && r.stage !== rule.stage)
    ]), []).map((r) => r.name);

    if (stateChanged.length > 0) {
      throw new ValidationError(`The following rules changed stage which is not allowed:
      ${dumpJSON(stateChanged)}.
      Rename the rules to recreate them and avoid this error.`);
    }

    await super.validate(assets);
  }

  async processChanges(assets) {
    const { rules } = assets;

    // Do nothing if not set
    if (!rules) return;

    // Figure out what needs to be updated vs created
    const changes = await this.calcChanges(assets);

    // Temporally re-order rules with conflicting ordering
    await this.client.pool.addEachTask({
      data: changes.reOrder,
      generator: (rule) => this.client.updateRule({ id: rule.id }, stripFields(rule, this.stripUpdateFields)).then(() => {
        const updated = {
          name: rule.name, stage: rule.stage, order: rule.order, id: rule.id
        };
        log.info(`Temporally re-order Rule ${dumpJSON(updated)}`);
      })
    }).promise();

    await super.processChanges(assets, {
      del: changes.del,
      create: changes.create,
      update: changes.update,
      conflicts: changes.conflicts
    });
  }
}
