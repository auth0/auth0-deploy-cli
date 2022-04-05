import pages from './pages';
import rules from './rules';
import hooks from './hooks';
import clients from './clients';
import tenant from './tenant';
import emailProvider from './emailProvider';
import connections from './connections';
import databases from './databases';
import emailTemplates from './emailTemplates';
import clientGrants from './clientGrants';
import rulesConfigs from './rulesConfigs';
import resourceServers from './resourceServers';
import guardianFactors from './guardianFactors';
import guardianFactorProviders from './guardianFactorProviders';
import guardianFactorTemplates from './guardianFactorTemplates';
import guardianPhoneFactorMessageTypes from './guardianPhoneFactorMessageTypes';
import guardianPhoneFactorSelectedProvider from './guardianPhoneFactorSelectedProvider';
import guardianPolicies from './guardianPolicies';
import roles from './roles';
import organizations from './organizations';
import migrations from './migrations';
import actions from './actions';
import triggers from './triggers';
import attackProtection from './attackProtection';
import branding from './branding';

import YAMLContext from '..';
import { AssetTypes } from '../../../types';

export type YAMLHandler<T> = {
  dump: (context: YAMLContext) => Promise<T | {}>; //May return empty object to signal
  parse: (context: YAMLContext) => Promise<T>;
};

const yamlHandlers: { [key in AssetTypes]: YAMLHandler<{ [key: string]: unknown }> } = {
  rules,
  hooks,
  rulesConfigs,
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
  migrations,
  guardianPhoneFactorMessageTypes,
  guardianPhoneFactorSelectedProvider,
  guardianPolicies,
  actions,
  organizations,
  triggers,
  attackProtection,
  branding,
};

export default yamlHandlers;
