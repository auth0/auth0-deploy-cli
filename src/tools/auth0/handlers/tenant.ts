import {
  TenantSettings,
  TenantSettingsFlags,
  TenantSettingsUpdate,
  TenantSettingsUpdateFlags,
} from 'auth0';
import { isEmpty } from 'lodash';
import ValidationError from '../../validationError';
import DefaultHandler, { order } from './default';
import { supportedPages, pageNameMap } from './pages';
import { convertJsonToString } from '../../utils';
import { Asset, Assets } from '../../../types';
import log from '../../../logger';
import sessionDurationsToMinutes from '../../../sessionDurationsToMinutes';

const tokenQuotaConfigurationSchema = {
  type: 'object',
  properties: {
    client_credentials: {
      type: 'object',
      properties: {
        enforce: {
          type: 'boolean',
          default: true,
        },
        per_day: {
          type: 'integer',
          minimum: 1,
        },
        per_hour: {
          type: 'integer',
          minimum: 1,
        },
      },
      additionalProperties: false,
      minProperties: 1,
    },
  },
  required: ['client_credentials'],
};

export const schema = {
  type: 'object',
  properties: {
    default_token_quota: {
      type: 'object',
      properties: {
        clients: tokenQuotaConfigurationSchema,
        organizations: tokenQuotaConfigurationSchema,
      },
      additionalProperties: false,
      minProperties: 1,
    },
  },
};

export type Tenant = TenantSettings;

const blockPageKeys = [
  ...Object.keys(pageNameMap),
  ...Object.values(pageNameMap),
  ...supportedPages,
];

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

export const removeUnallowedTenantFlags = (
  proposedFlags: TenantSettingsFlags
): TenantSettingsFlags => {
  if (proposedFlags === undefined) return {} as unknown as TenantSettingsFlags;

  const removedFlags: string[] = [];
  const filteredFlags = Object.keys(proposedFlags).reduce(
    (acc: TenantSettingsFlags, proposedKey: string): TenantSettingsFlags => {
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
    {} as unknown as TenantSettingsFlags
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

export default class TenantHandler extends DefaultHandler {
  existing: Tenant;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'tenant',
    });
  }

  async getType(): Promise<Asset> {
    const { data: tenant } = await this.client.tenants.getSettings();

    tenant.flags = removeUnallowedTenantFlags(tenant.flags);

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

    console.log('[CLOG] data:', tenant);

    // Do nothing if not set
    if (!tenant) return;

    const updatedTenant: TenantSettingsUpdate = {
      ...tenant,
      flags: tenant.flags
        ? (removeUnallowedTenantFlags(tenant.flags) as TenantSettingsUpdateFlags)
        : undefined,
    };

    if ('flags' in updatedTenant) {
      if (updatedTenant.flags === undefined || Object.keys(updatedTenant.flags).length === 0) {
        delete updatedTenant.flags;
      }
    }

    if (updatedTenant && Object.keys(updatedTenant).length > 0) {
      const sessionDurations = sessionDurationsToMinutes(
        updatedTenant?.session_lifetime,
        updatedTenant?.idle_session_lifetime
      );

      let updateTenantPayload = updatedTenant;
      if (!isEmpty(sessionDurations)) {
        updateTenantPayload = { ...updateTenantPayload, ...sessionDurations };
      }

      await this.client.tenants.updateSettings(updateTenantPayload);
      this.updated += 1;
      this.didUpdate(updatedTenant);
    }
  }
}
