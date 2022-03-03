async function parse(context) {
  return {
    attackProtection: context.assets.attackProtection || {}
  };
}

async function dump(context) {
  return {
    attackProtection: context.assets.attackProtection || {}
  };
}

export default {
  parse,
  dump
};
