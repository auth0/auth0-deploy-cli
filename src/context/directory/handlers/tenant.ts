import path from 'path';
import {
  existsMustBeDir, isFile, dumpJSON, loadJSON, hoursAsInteger, clearTenantFlags
} from '../../../utils';
import { DirectoryHandler, Context } from '.'

type ParsedTenant = {
  tenant: {
    session_lifetime: number,
    idle_session_lifetime: number,
    [key: string]: unknown,
  }
} | {}

function parse(context: Context): ParsedTenant {
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
      tenant: {
        ...tenant,
        session_lifetime_in_minutes: hoursAsInteger('session_lifetime', session_lifetime)['session_lifetime_in_minutes'],
        idle_session_lifetime_in_minutes: hoursAsInteger('idle_session_lifetime', idle_session_lifetime)['idle_session_lifetime_in_minutes'],
      }
    };
    /* eslint-enable camelcase */
  }

  return {};
}

async function dump(context: Context): Promise<void> {
  const { tenant } = context.assets;

  if (!tenant) return; // Skip, nothing to dump

  clearTenantFlags(tenant);

  const tenantFile = path.join(context.filePath, 'tenant.json');
  dumpJSON(tenantFile, tenant);
  return
}

const tenantHandler: DirectoryHandler<ParsedTenant> = {
  parse,
  dump,
}

export default tenantHandler;