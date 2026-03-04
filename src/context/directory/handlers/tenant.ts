import path from 'path';
import { existsMustBeDir, isFile, dumpJSON, loadJSON, clearTenantFlags } from '../../../utils';
import { sessionDurationsToMinutes } from '../../../sessionDurationsToMinutes';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTenant = ParsedAsset<'tenant', Asset>;

function parse(context: DirectoryContext): ParsedTenant {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return { tenant: null }; // Skip

  const tenantFile = path.join(baseFolder, 'tenant.json');

  if (!isFile(tenantFile)) {
    return { tenant: null };
  }

  const tenant = loadJSON(tenantFile, {
    mappings: context.mappings,
    disableKeywordReplacement: context.disableKeywordReplacement,
  });

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
    // @ts-ignore
    tenant,
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { tenant } = context.assets;

  if (!tenant) return; // Skip, nothing to dump

  clearTenantFlags(tenant);

  const tenantFile = path.join(context.filePath, 'tenant.json');
  dumpJSON(tenantFile, tenant);
}

const tenantHandler: DirectoryHandler<ParsedTenant> = {
  parse,
  dump,
};

export default tenantHandler;
