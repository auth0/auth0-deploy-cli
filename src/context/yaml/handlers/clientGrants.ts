import { convertClientIdToName } from '../../../utils';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { ParsedAsset } from '../../../types';
import { ClientGrant } from '../../../tools/auth0/handlers/clientGrants';
import { convertClientNameToId } from '../../../tools/utils';

type ParsedClientGrants = ParsedAsset<'clientGrants', ClientGrant[]>;

async function parse(context: YAMLContext): Promise<ParsedClientGrants> {
  const { clientGrants } = context.assets;

  if (!clientGrants) return { clientGrants: null };

  const shouldPreserveKeywords =
    // @ts-ignore because the string=>boolean conversion may not have happened if passed-in as env var
    context.config.AUTH0_PRESERVE_KEYWORDS === 'true' ||
    context.config.AUTH0_PRESERVE_KEYWORDS === true;

  if (shouldPreserveKeywords) {
    // AUTH0_PRESERVE_KEYWORDS need client id instead for client name
    // here can not use client from context.assets because it does not have the client_id
    const clients = await context.mgmtClient.clients.getAll({
      paginate: true,
      include_totals: true,
    });

    return {
      clientGrants: clientGrants.map((grant) => {
        const dumpGrant = { ...grant };
        dumpGrant.client_id = convertClientNameToId(dumpGrant.client_id, clients || []);
        return dumpGrant;
      }),
    };
  }

  return { clientGrants };
}

async function dump(context: YAMLContext): Promise<ParsedClientGrants> {
  const { clientGrants } = context.assets;
  let { clients } = context.assets;

  if (!clientGrants) return { clientGrants: null };

  if (clients === undefined) {
    clients = await context.mgmtClient.clients.getAll({
      paginate: true,
      include_totals: true,
    });
  }

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
