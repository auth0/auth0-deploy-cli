import pages from './pages';
import clients from './clients';
import tenant from './tenant';
import emailProvider from './emailProvider';
import connections from './connections';
import databases from './databases';
import emailTemplates from './emailTemplates';
import clientGrants from './clientGrants';
import resourceServers from './resourceServers';
import guardianFactors from './guardianFactors';
import guardianFactorProviders from './guardianFactorProviders';
import guardianFactorTemplates from './guardianFactorTemplates';
import guardianPhoneFactorMessageTypes from './guardianPhoneFactorMessageTypes';
import guardianPhoneFactorSelectedProvider from './guardianPhoneFactorSelectedProvider';
import guardianPolicies from './guardianPolicies';
import roles from './roles';
import actions from './actions';
import organizations from './organizations';
import triggers from './triggers';
import attackProtection from './attackProtection';
import branding from './branding';
import logStreams from './logStreams';
import prompts from './prompts';
import customDomains from './customDomains';
import themes from './themes';

import DirectoryContext from '..';
import { AssetTypes, Asset } from '../../../types';

export type DirectoryHandler<T> = {
  dump: (context: DirectoryContext) => void;
  parse: (context: DirectoryContext) => T;
};

const directoryHandlers: {
  [key in AssetTypes]: DirectoryHandler<{ [key: string]: Asset | Asset[] | null }>;
} = {
  pages,
  databases,
  clientGrants,
  resourceServers,
  clients,
  connections,
  tenant,
  emailProvider,
  emailTemplates,
  guardianFactors,
  guardianFactorProviders,
  guardianFactorTemplates,
  guardianPhoneFactorMessageTypes,
  guardianPhoneFactorSelectedProvider,
  guardianPolicies,
  roles,
  actions,
  organizations,
  triggers,
  attackProtection,
  branding,
  logStreams,
  prompts,
  customDomains,
  themes,
};

export default directoryHandlers;
