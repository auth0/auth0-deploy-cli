import rules from './rules';
import rulesConfigs from './rulesConfigs';
import hooks from './hooks';
import pages from './pages';
import resourceServers from './resourceServers';
import databases from './databases';
import connections from './connections';
import clients from './clients';
import tenant from './tenant';
import emailProvider from './emailProvider';
import emailTemplates from './emailTemplates';
import clientGrants from './clientGrants';
import guardianFactors from './guardianFactors';
import guardianFactorProviders from './guardianFactorProviders';
import guardianFactorTemplates from './guardianFactorTemplates';
import guardianPolicies from './guardianPolicies';
import guardianPhoneFactorSelectedProvider from './guardianPhoneFactorSelectedProvider';
import guardianPhoneFactorMessageTypes from './guardianPhoneFactorMessageTypes';
import roles from './roles';
import branding from './branding';
import prompts from './prompts';
import migrations from './migrations';
import actions from './actions';
import triggers from './triggers';
import organizations from './organizations';
import attackProtection from './attackProtection';

import { AssetTypes } from '../../../types';
import APIHandler from './default'

// @ts-ignore
const auth0ApiHandlers: { [key in AssetTypes]: any } = {
  rules,
  rulesConfigs,
  hooks,
  pages,
  resourceServers,
  clients,
  databases,
  connections,
  tenant,
  emailProvider,
  emailTemplates,
  clientGrants,
  guardianFactors,
  guardianFactorProviders,
  guardianFactorTemplates,
  guardianPolicies,
  guardianPhoneFactorSelectedProvider,
  guardianPhoneFactorMessageTypes,
  roles,
  branding,
  //@ts-ignore because prompts don't appear to have been universally implemented yet
  prompts,
  migrations,
  actions,
  triggers,
  organizations,
  attackProtection
};

export default auth0ApiHandlers as { [key in AssetTypes]: typeof APIHandler };