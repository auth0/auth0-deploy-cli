import path from 'path';
import {
  existsMustBeDir, isFile, dumpJSON, loadJSON, clearTenantFlags
} from '../../../utils';
import { sessionDurationsToMinutes } from '../../../sessionDurationsToMinutes'
import { DirectoryHandler } from '.'
import DirectoryContext from '..'

type ParsedTenant = {
  tenant: {
    session_lifetime: number,
    idle_session_lifetime: number,
    [key: string]: unknown,
  }
} | {}

function parse(context: DirectoryContext): ParsedTenant {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return {}; // Skip

  const tenantFile = path.join(baseFolder, 'tenant.json');

  if (isFile(tenantFile)) {
    /* eslint-disable camelcase */
    const {
      session_lifetime,
      idle_session_lifetime,
      ...tenant
    }: {
      session_lifetime?: number
      idle_session_lifetime?: number,
      [key: string]: any
    } = loadJSON(tenantFile, context.mappings);

    clearTenantFlags(tenant);

    const sessionDurations = sessionDurationsToMinutes({ session_lifetime, idle_session_lifetime })

    return {
      tenant,
      ...sessionDurations
    };
  }

  return {};
}

async function dump(context: DirectoryContext): Promise<void> {
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