import { clearClientArrays } from '../../../utils';

async function parse(context) {
  // nothing to do, set default empty
  return {
    clients: context.assets.clients
  };
}

async function dump(context) {
  const clients = context.assets.clients || [];
  return {
    clients: clients.map(clearClientArrays)
  };
}


export default {
  parse,
  dump
};
