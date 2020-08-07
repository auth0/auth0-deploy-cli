import { clearTenantFlags } from '../../../utils';


async function dump(context) {
  const tenant = { ...(context.assets.tenant || {}) };

  clearTenantFlags(tenant);

  return {
    type: 'auth0_tenant',
    name: 'tenant',
    content: tenant
  };
}

export default {
  dump
};
