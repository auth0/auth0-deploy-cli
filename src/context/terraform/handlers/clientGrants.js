import { tfNameSantizer } from '../../../utils';

async function parse(context) {
  throw new Error('Not Implemented ' + context);
}


async function dump(context) {
  const clients = context.assets.clientsOrig || [];

  return (context.assets.clientGrants || []).map((grant) => {
    const dumpGrant = { ...grant };
    const found = clients.find(c => c.client_id === dumpGrant.client_id);
    if (found) dumpGrant.client_id = `\${auth0_client.${tfNameSantizer(found.name)}.client_id}`;

    return {
      type: 'auth0_client_grant',
      name: `${dumpGrant.client_id}_grant`,
      content: dumpGrant
    };
  });
}


export default {
  parse,
  dump
};
