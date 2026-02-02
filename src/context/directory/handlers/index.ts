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
import actionModules from './actionModules';
import organizations from './organizations';
import triggers from './triggers';
import attackProtection from './attackProtection';
import riskAssessment from './riskAssessment';
import branding from './branding';
import phoneProviders from './phoneProvider';
import phoneTemplates from './phoneTemplates';
import logStreams from './logStreams';
import prompts from './prompts';
import customDomains from './customDomains';
import themes from './themes';
import rules from './rules';
import hooks from './hooks';
import rulesConfigs from './rulesConfigs';
import forms from './forms';
import flows from './flows';
import flowVaultConnections from './flowVaultConnections';
import networkACLs from './networkACLs';
import userAttributeProfiles from './userAttributeProfiles';
import connectionProfiles from './connectionProfiles';
import tokenExchangeProfiles from './tokenExchangeProfiles';

import DirectoryContext from '..';
import { AssetTypes, Asset } from '../../../types';
import selfServiceProfiles from './selfServiceProfiles';

export type DirectoryHandler<T> = {
  dump: (context: DirectoryContext) => void;
  parse: (context: DirectoryContext) => T;
};

const directoryHandlers: {
  [key in AssetTypes]: DirectoryHandler<{ [key: string]: Asset | Asset[] | null }>;
} = {
  rules,
  rulesConfigs,
  hooks,
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
  actionModules,
  organizations,
  triggers,
  attackProtection,
  riskAssessment,
  branding,
  phoneProviders,
  phoneTemplates,
  logStreams,
  prompts,
  customDomains,
  themes,
  forms,
  flows,
  flowVaultConnections,
  selfServiceProfiles,
  networkACLs,
  userAttributeProfiles,
  connectionProfiles,
  tokenExchangeProfiles,
};

export default directoryHandlers;
