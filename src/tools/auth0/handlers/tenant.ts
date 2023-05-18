import ValidationError from '../../validationError';

import DefaultHandler, { order } from './default';
import { supportedPages, pageNameMap } from './pages';
import { convertJsonToString } from '../../utils';
import { Asset, Assets, Language } from '../../../types';

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

    const existingTenant = this.existing || (await this.getType());

    const updatedTenant = {
      ...tenant,
    };

    if ('flags' in updatedTenant) {
      updatedTenant.flags = sanitizeMigrationFlags({
        existingFlags: existingTenant.flags,
        proposedFlags: tenant.flags,
      });
    }

    if (updatedTenant && Object.keys(updatedTenant).length > 0) {
      await this.client.tenant.updateSettings(updatedTenant);
      this.updated += 1;
      this.didUpdate(updatedTenant);
    }
  }
}

export const sanitizeMigrationFlags = ({
  existingFlags = {},
  proposedFlags = {},
}: {
  existingFlags: Tenant['flags'];
  proposedFlags: Tenant['flags'];
}): Tenant['flags'] => {
  /*
  Tenants can only update migration flags that are already configured.
  If moving configuration from one tenant to another, there may be instances
  where different migration flags exist and cause an error on update. This
  function removes any migration flags that aren't already present on the target
  tenant. See: https://github.com/auth0/auth0-deploy-cli/issues/374
  */

  const tenantMigrationFlags = [
    'disable_clickjack_protection_headers',
    'enable_mgmt_api_v1',
    'trust_azure_adfs_email_verified_connection_property',
    'include_email_in_reset_pwd_redirect',
    'include_email_in_verify_email_redirect',
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
    'no_disclose_enterprise_connections',
    'disable_management_api_sms_obfuscation',
    'enforce_client_authentication_on_passwordless_start',
    'enable_adfs_waad_email_verification',
    'revoke_refresh_token_grant',
    'dashboard_log_streams_next',
    'dashboard_insights_view',
    'disable_fields_map_fix',
    'mfa_show_factor_list_on_enrollment',
  ];

  return Object.keys(proposedFlags).reduce(
    (acc: Tenant['flags'], proposedKey: string): Tenant['flags'] => {
      const isMigrationFlag = tenantMigrationFlags.includes(proposedKey);
      if (!isMigrationFlag)
        return {
          ...acc,
          [proposedKey]: proposedFlags[proposedKey],
        };

      const keyCurrentlyExists = existingFlags[proposedKey] !== undefined;
      if (keyCurrentlyExists)
        return {
          ...acc,
          [proposedKey]: proposedFlags[proposedKey],
        };

      return acc;
    },
    {}
  );
};
