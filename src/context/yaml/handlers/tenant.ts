import { clearTenantFlags } from '../../../utils';
import { sessionDurationsToMinutes } from '../../../sessionDurationsToMinutes';
import { YAMLHandler } from '.';
import YAMLContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTenant = ParsedAsset<'tenant', Asset>;

async function parse(context: YAMLContext): Promise<ParsedTenant> {
  if (!context.assets.tenant) return { tenant: null };

  const { tenant } = context.assets;

  clearTenantFlags(tenant);

  const sessionDurations = sessionDurationsToMinutes({
    session_lifetime: tenant.session_lifetime,
    idle_session_lifetime: tenant.idle_session_lifetime,
    ephemeral_session_lifetime: tenant.ephemeral_session_lifetime,
    idle_ephemeral_session_lifetime: tenant.idle_ephemeral_session_lifetime,
  });

  if (Object.keys(sessionDurations).length > 0) {
    delete tenant.session_lifetime;
    delete tenant.idle_session_lifetime;
    delete tenant.ephemeral_session_lifetime;
    delete tenant.idle_ephemeral_session_lifetime;
    Object.assign(tenant, sessionDurations);
  }

  return {
    tenant,
  };
}

async function dump(context: YAMLContext): Promise<ParsedTenant> {
  const { tenant } = context.assets;

  if (!tenant) return { tenant: null };

  clearTenantFlags(tenant);

  return { tenant };
}

const tenantHandler: YAMLHandler<ParsedTenant> = {
  parse,
  dump,
};

export default tenantHandler;
