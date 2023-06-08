import ValidationError from '../../validationError';

import DefaultHandler, { order } from './default';
import { supportedPages, pageNameMap } from './pages';
import { convertJsonToString } from '../../utils';
import { Asset, Assets, Language } from '../../../types';
import log from '../../../logger';

export const schema = {
  type: 'object',
};

export type Tenant = Asset & { enabled_locales?: Language[]; flags: { [key: string]: boolean } };

const blockPageKeys = [
  ...Object.keys(pageNameMap),
  ...Object.values(pageNameMap),
  ...supportedPages,
];

export default class TenantHandler extends DefaultHandler {
  existing: Tenant;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'tenant',
    });
  }

  async getType(): Promise<Asset> {
    const tenant = await this.client.tenant.getSettings();

    this.existing = tenant;

    blockPageKeys.forEach((key) => {
      if (tenant[key]) delete tenant[key];
    });

    return tenant;
  }

  async validate(assets: Assets): Promise<void> {
    const { tenant } = assets;

    // Nothing to validate?
    if (!tenant) return;

    const pageKeys = Object.keys(tenant).filter((k) => blockPageKeys.includes(k));
    if (pageKeys.length > 0) {
      throw new ValidationError(
        `The following pages ${convertJsonToString(
          pageKeys
        )} were found in tenant settings. Pages should be set separately. Please refer to the documentation.`
      );
    }
  }

  // Run after other updates so objected can be referenced such as default directory
  @order('100')
  async processChanges(assets: Assets): Promise<void> {
    const { tenant } = assets;

    // Do nothing if not set
    if (!tenant) return;

    const updatedTenant: Partial<Tenant> = {
      ...tenant,
    };

    if ('flags' in updatedTenant) {
      updatedTenant.flags = removeUnallowedTenantFlags(tenant.flags);
      if (Object.keys(updatedTenant.flags).length === 0) {
        delete updatedTenant.flags;
      }
    }

    if (updatedTenant && Object.keys(updatedTenant).length > 0) {
      await this.client.tenant.updateSettings(updatedTenant);
      this.updated += 1;
      this.didUpdate(updatedTenant);
    }
  }
}

/*
 Tenant flags are used to facilitate a number of functionalities, some
 public, some internal. The subset of flags that are allowed to be updated 
 in the context of the Deploy CLI is based on wether they're publicly exposed
 in the Auth0 API docs:

 https://auth0.com/docs/api/management/v2#!/Tenants/patch_settings
*/
export const allowedTenantFlags = [
  'change_pwd_flow_v1',
  'enable_client_connections',
  'enable_apis_section',
  'enable_pipeline2',
  'enable_dynamic_client_registration',
  'enable_custom_domain_in_emails',
  'allow_legacy_tokeninfo_endpoint',
  'enable_legacy_profile',
  'enable_idtoken_api2',
  'enable_public_signup_user_exists_error',
  'allow_legacy_delegation_grant_types',
  'allow_legacy_ro_grant_types',
  'enable_sso',
  'disable_clickjack_protection_headers',
  'no_disclose_enterprise_connections',
  'disable_management_api_sms_obfuscation',
  'enforce_client_authentication_on_passwordless_start',
  'trust_azure_adfs_email_verified_connection_property',
  'enable_adfs_waad_email_verification',
  'revoke_refresh_token_grant',
  'dashboard_log_streams_next',
  'dashboard_insights_view',
  'disable_fields_map_fix',
  'require_pushed_authorization_requests',
  'mfa_show_factor_list_on_enrollment',
];

export const removeUnallowedTenantFlags = (proposedFlags: Tenant['flags']): Tenant['flags'] => {
  const removedFlags: string[] = [];
  const filteredFlags = Object.keys(proposedFlags).reduce(
    (acc: Tenant['flags'], proposedKey: string): Tenant['flags'] => {
      const isAllowedFlag = allowedTenantFlags.includes(proposedKey);
      if (!isAllowedFlag) {
        removedFlags.push(proposedKey);
        return acc;
      }
      return {
        ...acc,
        [proposedKey]: proposedFlags[proposedKey],
      };
    },
    {}
  );

  if (removedFlags.length > 0) {
    log.warn(
      `The following tenant flag${
        removedFlags.length > 1 ? 's have not been' : ' has not been'
      } updated because deemed incompatible with the target tenant: ${removedFlags.join(', ')}
      ${
        removedFlags.length > 1 ? 'These flags' : 'This flag'
      } can likely be removed from the tenant definition file. If you believe this removal is an error, please report via a Github issue.`
    );
  }

  return filteredFlags;
};
