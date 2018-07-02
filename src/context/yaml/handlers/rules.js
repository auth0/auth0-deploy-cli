import { unifyScripts } from 'auth0-source-control-extension-tools';
import { loadFile } from 'src/utils';

const rulesSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'A script that contains the rule\'s code',
        default: ''
      },
      name: {
        type: 'string',
        description: 'The name of the rule. Can only contain alphanumeric characters, spaces and \'-\'. Can neither start nor end with \'-\' or spaces',
        pattern: '^[^-][a-zA-Z-]+[^-]$'
      },
      order: {
        type: 'number',
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
    required: [
      'name'
    ],
    additionalProperties: false
  }
};


export const schema = {
  type: 'object',
  properties: {
    rules: rulesSchema,
    exclude: {
      type: 'array',
      items: { type: 'string' }
    },
    settings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', pattern: '^[A-Za-z0-9_-]*$' },
          value: { type: 'string' }
        }
      }
    }
  },
  additionalProperties: false
};


export function parse(config) {
  const rules = config.rules.map((rule) => {
    // First check if metadata is string, then load json
    const script = loadFile(rule.script, process.env);
    const metadata = {
      name: rule.name,
      order: rule.order,
      stage: rule.stage,
      enabled: rule.enabled
    };

    return {
      metadataFile: JSON.stringify(metadata),
      metadata: true,
      name: metadata.name,
      scriptFile: script,
      script: true
    };
  });

  const ruleConfigs = config.settings.map(rule => ({
    configFile: JSON.stringify(rule),
    name: rule.key
  }));

  return {
    rules: unifyScripts(rules, {}),
    excluded_rules: config.exclude,
    ruleConfigs: unifyScripts(ruleConfigs, {})
  };
}
