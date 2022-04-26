import path from 'path';
import { existsMustBeDir, isFile, dumpJSON, loadJSON, clearTenantFlags } from '../../../utils';
import { sessionDurationsToMinutes } from '../../../sessionDurationsToMinutes';
import { DirectoryHandler } from '.';
import DirectoryContext from '..';
import { Asset, ParsedAsset } from '../../../types';

type ParsedTenant = ParsedAsset<
  'tenant',
  {
    session_lifetime: number;
    idle_session_lifetime: number;
  } & {
    [key: string]: Asset;
  }
>;

function parse(context: DirectoryContext): ParsedTenant {
  const baseFolder = path.join(context.filePath);
  if (!existsMustBeDir(baseFolder)) return { tenant: null }; // Skip

  const tenantFile = path.join(baseFolder, 'tenant.json');

  if (!isFile(tenantFile)) {
    return { tenant: null };
  }
  /* eslint-disable camelcase */
  const {
    session_lifetime,
    idle_session_lifetime,
    ...tenant
  }: {
    session_lifetime?: number;
    idle_session_lifetime?: number;
    [key: string]: any;
  } = loadJSON(tenantFile, context.mappings);

  clearTenantFlags(tenant);

  const sessionDurations = sessionDurationsToMinutes({ session_lifetime, idle_session_lifetime });

  return {
    //@ts-ignore
    tenant: {
      ...tenant,
      ...sessionDurations,
    },
  };
}

async function dump(context: DirectoryContext): Promise<void> {
  const { tenant } = context.assets;

  if (!tenant) return; // Skip, nothing to dump

  clearTenantFlags(tenant);

  const tenantFile = path.join(context.filePath, 'tenant.json');
  dumpJSON(tenantFile, tenant);
  return;
}

const tenantHandler: DirectoryHandler<ParsedTenant> = {
  parse,
  dump,
};

export default tenantHandler;
