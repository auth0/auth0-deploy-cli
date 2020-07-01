async function parse(context) {
  const { migrations } = context.assets;
  return { migrations };
}

async function dump(context) {
  const { migrations } = context.assets;

  return { migrations: migrations || {} };
}


export default {
  parse,
  dump
};
