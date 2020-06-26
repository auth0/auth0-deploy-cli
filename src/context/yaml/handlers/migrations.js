async function parse(context) {
  const { migrations } = context.assets;
  return { migrations };
}


async function dump(context) {
  const { migrations  } = context.assets;
  if (!migrations) { return {}; }

  return { migrations };
}


export default {
  parse,
  dump
};
