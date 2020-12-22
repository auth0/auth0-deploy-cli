import { convertClientIdToName } from '../../../utils';

async function parse(context) {
  // nothing to do, set default empty
  return {
    clientGrants: context.assets.clientGrants
  };
}

async function dump(context) {
  const { clientGrants } = context.assets;

  // Nothing to do
  if (!clientGrants) return {};

  // Convert client_id to the client name for readability
  return {
    clientGrants: clientGrants.map((grant) => {
      const dumpGrant = { ...grant };
      dumpGrant.client_id = convertClientIdToName(dumpGrant.client_id, context.assets.clients);
      return dumpGrant;
    })
  };
}


export default {
  parse,
  dump
};
