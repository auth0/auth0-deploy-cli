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
import organizations from './organizations';
import actions from './actions';
import triggers from './triggers';
import attackProtection from './attackProtection';
import branding from './branding';
import logStreams from './logStreams';
import prompts from './prompts';
import customDomains from './customDomains';
import themes from './themes';
import rules from './rules';
import rulesConfigs from './rulesConfigs';
import hooks from './hooks';
import forms from './forms';
import flows from './flows';
import flowVaultConnections from './flowVaultConnections';

import YAMLContext from '..';
import { AssetTypes } from '../../../types';

export type YAMLHandler<T> = {
  dump: (context: YAMLContext) => Promise<T>;
  parse: (context: YAMLContext) => Promise<T>;
};

const yamlHandlers: { [key in AssetTypes]: YAMLHandler<{ [key: string]: unknown }> } = {
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
  roles,
  guardianPhoneFactorMessageTypes,
  guardianPhoneFactorSelectedProvider,
  guardianPolicies,
  actions,
  organizations,
  triggers,
  attackProtection,
  branding,
  logStreams,
  prompts,
  customDomains,
  themes,
  forms,
  flows,
  flowVaultConnections,
};

export default yamlHandlers;
