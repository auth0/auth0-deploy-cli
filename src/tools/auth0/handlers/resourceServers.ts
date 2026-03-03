import { Management } from 'auth0';
import ValidationError from '../../validationError';

import constants from '../../constants';
import DefaultHandler from './default';
import { calculateChanges } from '../../calculateChanges';
import { Assets, CalculatedChanges } from '../../../types';
import { paginate } from '../client';

export const excludeSchema = {
  type: 'array',
  items: { type: 'string' },
};

export type ResourceServer = Management.ResourceServer;

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
        },
        additionalProperties: false,
      },
      client_id: {
        type: 'string',
        description:
          'The client ID of the client that this resource server is linked to (readonly)',
        readOnly: true,
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

  async calcChanges(assets: Assets): Promise<CalculatedChanges> {
    let { resourceServers } = assets;

    // Do nothing if not set
    if (!resourceServers)
      return {
        del: [],
        create: [],
        conflicts: [],
        update: [],
      };

    const excluded = (assets.exclude && assets.exclude.resourceServers) || [];

    let existing = await this.getType();

    // Filter excluded
    resourceServers = resourceServers.filter((r) => r.name && !excluded.includes(r.name));
    existing = existing.filter((r) => r.name && !excluded.includes(r.name));

    return calculateChanges({
      handler: this,
      assets: resourceServers,
      existing,
      identifiers: this.identifiers,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });
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

    await super.validate(assets);
  }

  async processChanges(assets: Assets): Promise<void> {
    const { resourceServers } = assets;

    // Do nothing if not set
    if (!resourceServers) return;

    const changes = await this.calcChanges(assets);

    await super.processChanges(assets, {
      ...changes,
    });
  }

  async updateResourceServer(
    id: string,
    update: ResourceServer
  ): Promise<Management.UpdateResourceServerResponseContent> {
    // Exclude name from update as it cannot be modified for system resource servers like Auth0 My Account API
    if (update.is_system === true || update.name === 'Auth0 My Account API') {
      const updateFields: Management.UpdateResourceServerRequestContent = {
        token_lifetime: update.token_lifetime,
        proof_of_possession: update.proof_of_possession,
        skip_consent_for_verifiable_first_party_clients:
          update.skip_consent_for_verifiable_first_party_clients,
        subject_type_authorization: update.subject_type_authorization,
      };

      return this.client.resourceServers.update(id, updateFields);
    }

    return this.client.resourceServers.update(id, update);
  }
}
