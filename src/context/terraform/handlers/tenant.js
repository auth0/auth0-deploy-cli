import { clearTenantFlags } from '../../../utils';

async function parse(context) {
  throw new Error('Not Implemented' + context);
}

async function dump(context) {
  const tenant = { ...(context.assets.tenant || {}) };

  clearTenantFlags(tenant);

  return {
    type: 'auth0-tenant',
    name: 'tenant',
    content: tenant
  };
}

export default {
  parse,
  dump
};
