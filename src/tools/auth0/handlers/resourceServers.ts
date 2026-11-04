import { Management } from 'auth0';
import ValidationError from '../../validationError';

import constants from '../../constants';
import DefaultHandler from './default';
import { Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';
import { isTruthy } from '../../../utils';

export const excludeSchema = {
  type: 'array',
  items: { type: 'string' },
};

// Not yet exposed by the auth0 SDK (`Management.ResourceServerTypeEnum`); switch to it once released.
const RESOURCE_SERVER_TYPE_UCP = 'universal_commerce_protocol_server';
const UCP_SCOPE_PREFIX = 'dev.ucp';

export type ResourceServer = Management.ResourceServer & { type?: string | null };

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      identifier: { type: 'string' },
      scopes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      allow_online_access: { type: 'boolean' },
      allow_online_access_with_ephemeral_sessions: { type: 'boolean' },
      enforce_policies: { type: 'boolean' },
      token_dialect: { type: 'string' },
      proof_of_possession: {
        type: 'object',
        properties: {
          mechanism: {
            type: 'string',
            enum: Object.values(Management.ResourceServerProofOfPossessionMechanismEnum),
          },
          required: { type: 'boolean' },
          required_for: {
            type: 'string',
            enum: Object.values(Management.ResourceServerProofOfPossessionRequiredForEnum),
          },
        },
        required: ['mechanism', 'required'],
      },
      subject_type_authorization: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            description: 'Access Permissions for user-initiated flows',
            properties: {
              policy: {
                type: 'string',
                enum: Object.values(
                  Management.ResourceServerSubjectTypeAuthorizationUserPolicyEnum
                ),
              },
            },
          },
          client: {
            type: 'object',
            description: 'Access Permissions for client-initiated flows',
            properties: {
              policy: {
                type: 'string',
                enum: Object.values(
                  Management.ResourceServerSubjectTypeAuthorizationClientPolicyEnum
                ),
              },
            },
          },
          anonymous_user: {
            type: 'object',
            description: 'Access Permissions for anonymous user flows',
            properties: {
              policy: {
                type: 'string',
                enum: Object.values(
                  Management.ResourceServerSubjectTypeAuthorizationAnonymousUserPolicyEnum
                ),
              },
            },
          },
        },
        additionalProperties: false,
      },
      token_lifetime_for_anonymous_access_tokens: {
        type: 'number',
        description:
          'Expiration value (in seconds) for anonymous-session access tokens issued for this API.',
      },
      access_token: {
        type: ['object', 'null'],
        description: 'Custom configuration for access tokens.',
        properties: {
          claims_mapping: {
            type: 'object',
            description: 'Custom configuration for claims in access tokens.',
            properties: {
              custom_claims: {
                type: 'array',
                description:
                  'Custom claims to emit in anonymous-session access tokens. Each rule maps a value from the anonymous-session context onto a named access-token claim.',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'The access-token claim name to emit.',
                    },
                    expression: {
                      type: 'string',
                      description:
                        'Restricted dot-path expression read from the anonymous-session context.',
                    },
                  },
                  required: ['name', 'expression'],
                },
              },
            },
          },
        },
      },
      client_id: {
        type: 'string',
        description:
          'The client ID of the client that this resource server is linked to (readonly)',
        readOnly: true,
      },
      require_consent_non_repudiation: {
        type: 'boolean',
        description:
          'When true, the authorization server rejects consent decisions that do not include a valid signature and kid. Requires the my_account_consents entitlement.',
      },
      type: {
        type: ['string', 'null'],
        enum: [RESOURCE_SERVER_TYPE_UCP, null],
        description:
          'The type of the resource server. Set to universal_commerce_protocol_server to declare a Universal Commerce Protocol server, or null to clear it.',
      },
    },
    required: ['name', 'identifier'],
  },
};

export default class ResourceServersHandler extends DefaultHandler {
  existing: ResourceServer[];

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'resourceServers',
      identifiers: ['id', 'identifier'],
      stripCreateFields: ['client_id', 'is_system'],
      stripUpdateFields: ['identifier', 'client_id', 'is_system'],
      functions: {
        update: (id: string, data) => this.updateResourceServer(id, data),
      },
    });
  }

  objString(resourceServer): string {
    return super.objString({ name: resourceServer.name, identifier: resourceServer.identifier });
  }

  async getType(): Promise<ResourceServer[]> {
    if (this.existing) return this.existing;

    let resourceServers = await paginate<ResourceServer>(this.client.resourceServers.list, {
      paginate: true,
    });

    resourceServers = resourceServers.filter(
      (rs) => rs.name !== constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME
    );

    // Sanitize resource servers fields
    const sanitizeResourceServersFields = (rs: ResourceServer[]): ResourceServer[] =>
      rs.map((resourceServer: ResourceServer) => {
        // For system resource servers like Auth0 My Account API, only allow certain fields to be updated
        if (resourceServer.is_system === true) {
          const allowedKeys = [
            'token_lifetime',
            'proof_of_possession',
            'skip_consent_for_verifiable_first_party_clients',
            'name',
            'identifier',
            'id',
            'is_system',
            'authorization_policy',
            'require_consent_non_repudiation',
          ];
          const sanitized: any = {};
          allowedKeys.forEach((key) => {
            if (key in resourceServer) {
              sanitized[key] = resourceServer[key];
            }
          });
          return sanitized;
        }

        return resourceServer;
      });

    this.existing = sanitizeResourceServersFields(resourceServers);

    return this.existing;
  }

  async validate(assets: Assets): Promise<void> {
    const { resourceServers } = assets;

    // Do nothing if not set
    if (!resourceServers) return;

    const mgmtAPIResource = resourceServers.find(
      (r) => r.name === constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME
    );
    if (mgmtAPIResource) {
      throw new ValidationError(
        `You can not configure the '${constants.RESOURCE_SERVERS_MANAGEMENT_API_NAME}'.`
      );
    }

    // Excluded and system servers never send `type` to the API, so they don't count below
    const excluded = assets.exclude?.resourceServers || [];
    const configured = resourceServers.filter(
      (r) => !excluded.includes(r.name ?? '') && r.is_system !== true
    );

    // The API allows only one UCP-typed resource server per tenant; fail early instead of on a 409
    const ucpResourceServers = configured.filter((r) => r.type === RESOURCE_SERVER_TYPE_UCP);
    if (ucpResourceServers.length > 1) {
      const names = ucpResourceServers.map((r) => r.name).join(', ');
      throw new ValidationError(
        `Only one resource server can have type '${RESOURCE_SERVER_TYPE_UCP}', found: ${names}.`
      );
    }

    // dev.ucp scopes are reserved for the UCP-typed server, so the API is likely to reject them once the type is cleared
    configured
      .filter(
        (r) =>
          r.type === null && r.scopes?.some((scope) => scope.value?.startsWith(UCP_SCOPE_PREFIX))
      )
      .forEach((r) =>
        log.warn(
          `'${r.name}' sets 'type: null' but still has '${UCP_SCOPE_PREFIX}' scopes, which are reserved for the UCP-typed resource server. Set 'scopes: []' on it or keep the type.`
        )
      );

    await super.validate(assets);
  }

  async processChanges(assets: Assets): Promise<void> {
    const { resourceServers } = assets;

    // Do nothing if not set
    if (!resourceServers) return;

    const excluded = (assets.exclude && assets.exclude.resourceServers) || [];

    const filterResourceServer = (items) => items.filter((r) => !excluded.includes(r.name));

    const { del, update, create, conflicts } = await this.calcChanges(assets);

    const changes = {
      del: filterResourceServer(del),
      update: filterResourceServer(update),
      create: filterResourceServer(create),
      conflicts: filterResourceServer(conflicts),
    };

    this.warnIfHolderStays(changes, excluded);

    // Only one resource server can hold the UCP type, so the holder giving it up is updated first
    const { releasing } = this.typeRelease(changes.update);
    if (releasing.length) {
      await super.processChanges(assets, { ...changes, update: releasing, create: [] });
      try {
        await super.processChanges(assets, {
          del: [],
          conflicts: [],
          create: changes.create,
          update: changes.update.filter((r) => !releasing.includes(r)),
        });
      } catch (err) {
        const names = releasing.map((r) => `'${r.name}'`).join(', ');
        throw new Error(
          `${err.message}\nThe type '${RESOURCE_SERVER_TYPE_UCP}' was already released from ${names} in this run, so no resource server has it until the import succeeds. Fix the error and re-run.`
        );
      }
      return;
    }

    await super.processChanges(assets, {
      ...changes,
    });
  }

  async dryRunChanges(assets: Assets): Promise<CalculatedChanges> {
    if (!assets.resourceServers) return super.dryRunChanges(assets);

    // A null type is the same as no type for a server that doesn't have one, so it isn't a change
    await this.getType();
    const resourceServers = assets.resourceServers.map((r) => {
      if (r.type !== null) return r;
      const remote = this.existing.find((e) => e.id === r.id || e.identifier === r.identifier);
      if (remote?.type) return r;
      const copy = { ...r };
      delete copy.type;
      return copy;
    });

    const changes = await super.dryRunChanges({ ...assets, resourceServers });
    this.warnIfHolderStays(changes, assets.exclude?.resourceServers || []);
    return changes;
  }

  // The tenant's UCP holder, and the updates that give the type up
  private typeRelease(update: ResourceServer[]) {
    const holder = this.existing?.find((e) => e.type === RESOURCE_SERVER_TYPE_UCP);
    const releasing = holder ? update.filter((r) => r.id === holder.id && r.type === null) : [];
    return { holder, releasing };
  }

  // Warns when another server is given the type but the holder is neither released nor deleted
  private warnIfHolderStays(changes: CalculatedChanges, excluded: string[]): void {
    const { holder, releasing } = this.typeRelease(changes.update);
    if (!holder || releasing.length) return;

    const taker = [...changes.create, ...changes.update].find(
      (r) => r.type === RESOURCE_SERVER_TYPE_UCP && r.id !== holder.id && !excluded.includes(r.name)
    );
    if (!taker) return;

    const holderInDel = changes.del.some((r) => r.id === holder.id);
    // Mirrors the delete gating in DefaultHandler.processChanges
    const deletes = isTruthy(this.config('AUTH0_ALLOW_DELETE')) || this.config('EXTENSION_SECRET');
    if (holderInDel && deletes) return;

    const { name } = holder;
    const hint = holderInDel
      ? `Set 'AUTH0_ALLOW_DELETE' to true to delete '${name}', or keep it in the config with 'type: null'.`
      : `Set 'type: null' on '${name}' in the same config to move it.`;
    log.warn(
      `'${name}' already has type '${RESOURCE_SERVER_TYPE_UCP}', so setting it on '${taker.name}' is likely to fail with a 409. ${hint}`
    );
  }

  async updateResourceServer(
    id: string,
    update: ResourceServer
  ): Promise<Management.UpdateResourceServerResponseContent> {
    // Exclude name from update as it cannot be modified for system resource servers like the
    // Auth0 My Account API or the Auth0 My Organization API. `is_system` is listed in
    // `stripUpdateFields`, so it has already been removed from `update` by the time this runs -
    // read it off the existing resource server instead, which `getType()` retains it on.
    const existing = this.existing?.find((resourceServer) => resourceServer.id === id);

    if (existing?.is_system === true) {
      const updateFields: Management.UpdateResourceServerRequestContent = {
        token_lifetime: update.token_lifetime,
        proof_of_possession: update.proof_of_possession,
        skip_consent_for_verifiable_first_party_clients:
          update.skip_consent_for_verifiable_first_party_clients,
        subject_type_authorization: update.subject_type_authorization,
        authorization_policy: update.authorization_policy,
        require_consent_non_repudiation: update.require_consent_non_repudiation,
      };

      return this.client.resourceServers.update(id, updateFields);
    }

    return this.client.resourceServers.update(id, update);
  }
}
