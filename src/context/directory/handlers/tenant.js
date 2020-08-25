import path from 'path';
import { existsMustBeDir, isFile, dumpJSON, loadJSON, hoursAsInteger, clearTenantFlags } from '../../../utils';

function parse(context) {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return {}; // Skip

  const tenantFile = path.join(baseFolder, 'tenant.json');

  if (isFile(tenantFile)) {
    /* eslint-disable camelcase */
    const {
      session_lifetime,
      idle_session_lifetime,
      ...tenant
    } = loadJSON(tenantFile, context.mappings);

    clearTenantFlags(tenant);

    return {
      tenant: Object.assign(
        tenant,
        session_lifetime && hoursAsInteger('session_lifetime', session_lifetime),
        idle_session_lifetime && hoursAsInteger('idle_session_lifetime', idle_session_lifetime)
      )
    };
    /* eslint-enable camelcase */
  }

  return {};
}


async function dump(context) {
  const { tenant } = context.assets;

  if (!tenant) return; // Skip, nothing to dump

  clearTenantFlags(tenant);

  const tenantFile = path.join(context.filePath, 'tenant.json');
  dumpJSON(tenantFile, tenant);
}


export default {
  parse,
  dump
};
