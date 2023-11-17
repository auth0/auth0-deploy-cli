import { convertClientIdToName } from '../../../utils';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { ClientGrant } from '../../../tools/auth0/handlers/clientGrants';

type ParsedClientGrants = ParsedAsset<'clientGrants', ClientGrant[]>;

async function parse(context: YAMLContext): Promise<ParsedClientGrants> {
  const { clientGrants } = context.assets;

  if (!clientGrants) return { clientGrants: null };

  return {
    clientGrants,
  };
}

async function dump(context: YAMLContext): Promise<ParsedClientGrants> {
  const { clientGrants } = context.assets;

  if (!clientGrants) return { clientGrants: null };

  const clients = await context.mgmtClient.clients.getAll({
    paginate: true,
    include_totals: true,
  })

  // Convert client_id to the client name for readability
  return {
    clientGrants: clientGrants.map((grant) => {
      const dumpGrant = { ...grant };
      dumpGrant.client_id = convertClientIdToName(dumpGrant.client_id, clients || []);
      return dumpGrant;
    }),
  };
}

const clientGrantsHandler: YAMLHandler<ParsedClientGrants> = {
  parse,
  dump,
};

export default clientGrantsHandler;
