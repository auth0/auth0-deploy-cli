import { clearTenantFlags } from '../../../utils';
import { sessionDurationsToMinutes } from '../../../sessionDurationsToMinutes';
import { YAMLHandler } from '.';
import YAMLContext from '..';

type ParsedTenant =
  | {
      tenant: unknown[];
    }
  | {};

async function parse(context: YAMLContext): Promise<ParsedTenant> {
  // Nothing to do
  if (!context.assets.tenant) return {};

  /* eslint-disable camelcase */
  const {
    session_lifetime,
    idle_session_lifetime,
    ...tenant
  }: {
    session_lifetime?: number;
    idle_session_lifetime?: number;
    [key: string]: any;
  } = context.assets.tenant;

  clearTenantFlags(tenant);

  const sessionDurations = sessionDurationsToMinutes({ session_lifetime, idle_session_lifetime });

  return {
    tenant: {
      ...tenant,
      ...sessionDurations,
    },
  };
}

async function dump(context: YAMLContext): Promise<ParsedTenant> {
  const tenant = { ...(context.assets.tenant || {}) };

  clearTenantFlags(tenant);

  return { tenant };
}

const tenantHandler: YAMLHandler<ParsedTenant> = {
  parse,
  dump,
};

export default tenantHandler;
