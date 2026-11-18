import YAMLContext from '..';
import { paginate } from '../../../tools/auth0/client';
import { Client } from '../../../tools/auth0/handlers/clients';
import { Portal } from '../../../tools/auth0/handlers/portals';
import { ParsedAsset } from '../../../types';
import { loadPortalReferences, toExportedPortal } from '../../../utils';
import { portalHasForms } from '../../../tools/utils';

type ParsedPortals = ParsedAsset<'portals', Partial<Portal>[]>;

async function parse(context: YAMLContext): Promise<ParsedPortals> {
  const { portals } = context.assets;

  if (!portals) return { portals: null };

  return {
    portals,
  };
}

async function dump(context: YAMLContext): Promise<ParsedPortals> {
  const { portals } = context.assets;

  if (!portals) return { portals: null };

  const clients = await loadPortalReferences(
    portals.some((portal) => portal.client?.client_id),
    context.assets.clients,
    () =>
      paginate<Client>(context.mgmtClient.clients.list, { paginate: true, include_totals: true }),
    'clients'
  );
  // Always listed: exported forms may not carry their ids.
  const forms = await loadPortalReferences(
    portals.some(portalHasForms),
    null,
    () => paginate(context.mgmtClient.forms.list, { paginate: true }),
    'forms'
  );

  return {
    portals: portals.map((portal) => toExportedPortal(portal, clients, forms)),
  };
}

const portalsHandler = {
  parse,
  dump,
};

export default portalsHandler;
