async function dump(context) {
  return (context.assets.hooks || []).map(hook => ({
    type: 'auth0_hook',
    name: hook.name,
    content: {
      name: hook.name,
      script: hook.script,
      trigger_id: hook.triggerId,
      enabled: hook.enabled
      // dependencies: hook.dependencies,
      // secrets: hook.secrets
    }
  }));
}

export default {
  dump
};
