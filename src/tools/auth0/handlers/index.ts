//TODO:
import * as rules from './rules';
import * as rulesConfigs from './rulesConfigs';
import * as hooks from './hooks';
import * as pages from './pages';
import * as resourceServers from './resourceServers';
import * as databases from './databases';
import * as connections from './connections';
import * as clients from './clients';
import * as tenant from './tenant';
import * as emailProvider from './emailProvider';
import * as emailTemplates from './emailTemplates';
import * as clientGrants from './clientGrants';
import * as guardianFactors from './guardianFactors';
import * as guardianFactorProviders from './guardianFactorProviders';
import * as guardianFactorTemplates from './guardianFactorTemplates';
import * as guardianPolicies from './guardianPolicies';
import * as guardianPhoneFactorSelectedProvider from './guardianPhoneFactorSelectedProvider';
import * as guardianPhoneFactorMessageTypes from './guardianPhoneFactorMessageTypes';
import * as roles from './roles';
import * as branding from './branding';
import * as prompts from './prompts';
import * as migrations from './migrations';
import * as actions from './actions';
import * as triggers from './triggers';
import * as organizations from './organizations';
import * as attackProtection from './attackProtection';
import * as logStreams from './logStreams';
import * as customDomains from './customDomains';
import * as themes from './themes';

import { AssetTypes } from '../../../types';
import APIHandler from './default';

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
  //@ts-ignore because prompts have not been universally implemented yet
  prompts,
  migrations,
  actions,
  triggers,
  organizations,
  attackProtection,
  logStreams,
  customDomains,
  themes,
};

export default auth0ApiHandlers as {
  [key in AssetTypes]: { default: typeof APIHandler; excludeSchema?: any; schema: any };
}; // TODO: apply stronger types to schema properties
