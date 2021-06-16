async function parse(context) {
  // Load the script file for each action
  if (!context.assets.triggers) return {};
  return {
    triggers: context.assets.triggers
  };
}

async function dump(context) {
  const { triggers } = context.assets;
  // Nothing to do
  if (!triggers) return {};
  return {
    triggers: triggers
  };
}

export default {
  parse,
  dump
};
