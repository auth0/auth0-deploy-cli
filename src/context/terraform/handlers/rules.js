async function parse(context) {
  throw new Error('Not Implemented' + context);
}

async function dump(context) {
  return (context.assets.rules || []).map(rule => ({
    type: 'auth0_rule',
    name: rule.name,
    content: {
      name: rule.name,
      script: rule.script,
      order: rule.order,
      enabled: rule.enabled
    }
  }));
}

export default {
  parse,
  dump
};
