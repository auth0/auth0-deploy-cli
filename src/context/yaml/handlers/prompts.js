async function parse(context) {
  // Nothing to do
  if (!context.assets.prompts) return {};

  /* eslint-disable camelcase */
  const { prompts } = context.assets;

  return {
    prompts: prompts
  };
  /* eslint-enable camelcase */
}

async function dump(context) {
  const prompts = { ...context.assets.prompts || {} };
  return { prompts };
}

export default {
  parse,
  dump
};
