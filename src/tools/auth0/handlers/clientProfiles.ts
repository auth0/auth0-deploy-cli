import { Management } from 'auth0';
import { Asset, Assets, Auth0APIClient, CalculatedChanges } from '../../../types';
import DefaultAPIHandler from './default';
import { paginate } from '../client';
import log from '../../../logger';

// The Management API allows at most one client profile per tenant (create returns 403 otherwise)
export const MAX_CLIENT_PROFILES_PER_TENANT = 1;

const defaultValueSchema = (valueSchema: object) => ({
  type: 'object',
  properties: {
    default_value: valueSchema,
  },
});

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
      },
      description: {
        type: ['string', 'null'],
      },
      client_configuration: {
        type: 'object',
        properties: {
          refresh_token: {
            type: 'object',
            properties: {
              token_lifetime: defaultValueSchema({ type: 'integer' }),
              idle_token_lifetime: defaultValueSchema({ type: 'integer' }),
              leeway: defaultValueSchema({ type: 'integer' }),
            },
          },
          organization_usage: defaultValueSchema({
            type: 'string',
            enum: ['deny', 'allow', 'require'],
          }),
          organization_require_behavior: defaultValueSchema({
            type: 'string',
            enum: ['no_prompt', 'pre_login_prompt', 'post_login_prompt'],
          }),
          organization_discovery_methods: defaultValueSchema({
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'organization_name'],
            },
          }),
          require_proof_of_possession: defaultValueSchema({ type: 'boolean' }),
        },
      },
      apply_policy: {
        type: 'object',
        properties: {
          external_metadata_type: {
            type: 'string',
            enum: ['cimd'],
          },
          external_metadata_created_by: {
            type: 'string',
            enum: ['client'],
          },
        },
        required: ['external_metadata_type', 'external_metadata_created_by'],
      },
    },
    required: ['name', 'client_configuration', 'apply_policy'],
  },
};

export type ClientProfile = Management.ClientProfile;

export const getClientProfiles = async (auth0Client: Auth0APIClient): Promise<ClientProfile[]> => {
  try {
    const clientProfiles = await paginate<ClientProfile>(auth0Client.clientProfiles?.list, {
      checkpoint: true,
      take: 50,
    });

    return clientProfiles;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 501) {
      return [];
    }
    if (err.statusCode === 403) {
      if (err.body?.errorCode === 'insufficient_scope') {
        log.warn(
          'Skipping client profiles: the deploy client is missing the `read:client_profiles` scope. Grant `read:client_profiles`, `create:client_profiles`, `update:client_profiles` and `delete:client_profiles` to manage client profiles.'
        );
        return [];
      }
      log.debug(
        'Client Profiles is not enabled for this tenant. Please verify `scope` or contact Auth0 support to enable this feature.'
      );
      return [];
    }
    throw err;
  }
};

export default class ClientProfilesHandler extends DefaultAPIHandler {
  existing: ClientProfile[];

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'clientProfiles',
      id: 'id',
      identifiers: ['id', 'name'],
      stripCreateFields: ['created_at', 'updated_at'],
      stripUpdateFields: ['created_at', 'updated_at'],
    });
  }

  objString(item): string {
    return super.objString({
      name: item.name,
    });
  }

  async getType(): Promise<ClientProfile[]> {
    if (this.existing) return this.existing;

    this.existing = await getClientProfiles(this.client);
    return this.existing;
  }

  // Fail before calling the API if creates would exceed the per-tenant limit,
  // e.g. a renamed profile while AUTH0_ALLOW_DELETE is off keeps the old one around.
  private assertWithinTenantLimit(del: Asset[], create: Asset[]): void {
    if (create.length === 0) return;

    const allowDelete =
      this.config('AUTH0_ALLOW_DELETE') === 'true' || this.config('AUTH0_ALLOW_DELETE') === true;
    const existingCount = (this.existing || []).length;
    const remainingCount = existingCount - (allowDelete ? del.length : 0) + create.length;
    if (remainingCount > MAX_CLIENT_PROFILES_PER_TENANT) {
      throw new Error(
        `Cannot create client profile(s) ${create
          .map((p) => `"${p.name}"`)
          .join(
            ', '
          )}: a tenant can have at most ${MAX_CLIENT_PROFILES_PER_TENANT} client profile(s) and ${existingCount} already exist(s). Keep the existing profile name to update it, or set AUTH0_ALLOW_DELETE=true to replace it.`
      );
    }
  }

  // Run the same limit check in dry run so the preview doesn't succeed for an import that would fail
  async dryRunChanges(assets: Assets): Promise<CalculatedChanges> {
    const changes = await super.dryRunChanges(assets);
    this.assertWithinTenantLimit(changes.del, changes.create);
    return changes;
  }

  async processChanges(assets: Assets): Promise<void> {
    const { clientProfiles } = assets;

    // Do nothing if not set
    if (!clientProfiles) return;

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    this.assertWithinTenantLimit(del, create);

    const changes = {
      del: del,
      update: update,
      create: create,
      conflicts: conflicts,
    };

    // Process using the default implementation
    await super.processChanges(assets, {
      ...changes,
    });
  }
}
