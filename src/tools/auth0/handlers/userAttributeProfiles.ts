import { UserAttributeProfile } from 'auth0';

import DefaultAPIHandler, { order } from './default';
import { Assets } from '../../../types';
import log from '../../../logger';
import { paginate } from '../client';
import { calculateChanges } from '../../calculateChanges';

const strategies = ['pingfederate', 'ad', 'adfs', 'waad', 'google-apps', 'okta', 'oidc', 'samlp'];
const strategyOverrides = {
  type: 'object',
  additionalProperties: false,
  properties: strategies.reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: {
        type: 'object',
        additionalProperties: false,
        properties: {
          oidc_mapping: {
            type: 'object',
            additionalProperties: false,
            required: ['mapping'],
            properties: {
              mapping: {
                type: 'string',
              },
              display_name: {
                type: 'string',
                minLength: 1,
                maxLength: 50,
              },
            },
          },
          saml_mapping: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
              maxLength: 128,
            },
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
          },
          scim_mapping: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
          },
        },
      },
    }),
    {}
  ),
};

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      user_id: {
        type: 'object',
        properties: {
          oidc_mapping: {
            type: 'string',
            enum: ['sub'],
            default: 'sub',
          },
          saml_mapping: {
            type: 'array',
            items: {
              type: 'string',
            },
            minItems: 1,
            maxItems: 3,
          },
          scim_mapping: {
            type: 'string',
            default: 'externalId',
          },
          strategy_overrides: {
            type: 'object',
            properties: strategies.reduce(
              (acc, curr) => ({
                ...acc,
                [curr]: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    oidc_mapping: {
                      type: 'string',
                      enum: ['sub', 'oid', 'email'],
                      minLength: 1,
                      maxLength: 50,
                    },
                    saml_mapping: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                      minItems: 1,
                      maxItems: 3,
                    },
                    scim_mapping: {
                      type: 'string',
                      default: 'externalId',
                    },
                  },
                },
              }),
              {}
            ),
          },
        },
      },
      user_attributes: {
        type: 'object',
        minProperties: 1,
        maxProperties: 64,
        additionalProperties: {
          type: 'object',
          required: ['description', 'label', 'profile_required', 'auth0_mapping'],
          additionalProperties: false,
          properties: {
            description: {
              description: 'Description of this attribute',
              type: 'string',
              minLength: 1,
              maxLength: 128,
            },
            label: {
              description: 'Display label for this attribute',
              type: 'string',
              minLength: 1,
              maxLength: 128,
            },
            profile_required: {
              description: 'Whether this attribute is required in the profile',
              type: 'boolean',
            },
            auth0_mapping: {
              description: 'Auth0 mapping for this attribute',
              type: 'string',
              minLength: 1,
              maxLength: 50,
            },
            oidc_mapping: {
              type: 'object',
              additionalProperties: false,
              required: ['mapping'],
              properties: {
                mapping: {
                  type: 'string',
                },
                display_name: {
                  description: 'Display name for the OIDC mapping',
                  type: 'string',
                  minLength: 1,
                  maxLength: 50,
                },
              },
            },
            saml_mapping: {
              type: 'array',
              items: {
                description: 'SAML mapping field',
                type: 'string',
                minLength: 1,
                maxLength: 128,
              },
              minItems: 1,
              maxItems: 3,
              uniqueItems: true,
            },
            scim_mapping: {
              type: 'string',
              minLength: 1,
              maxLength: 128,
            },
            strategy_overrides: strategyOverrides,
          },
        },
      },
    },
  },
};

export default class UserAttributeProfilesHandler extends DefaultAPIHandler {
  existing: UserAttributeProfile[];

  constructor(options: DefaultAPIHandler) {
    super({
      ...options,
      type: 'userAttributeProfiles',
      id: 'id',
      identifiers: ['id', 'name'],
      stripUpdateFields: ['id'],
    });
  }

  async getType() {
    if (this.existing) return this.existing;

    this.existing = await paginate<UserAttributeProfile>(this.client.userAttributeProfiles.getAll, {
      checkpoint: true,
      include_totals: true,
      is_global: false,
      take: 10,
    });

    return this.existing;
  }

  @order('50')
  async processChanges(assets: Assets): Promise<void> {
    const { userAttributeProfiles } = assets;

    // Do nothing if not set
    if (!userAttributeProfiles) return;

    const existing = await this.getType();

    const changes = calculateChanges({
      handler: this,
      assets: userAttributeProfiles,
      existing,
      identifiers: this.identifiers,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });

    log.debug(
      `Start processChanges for userAttributeProfile [delete:${changes.del.length}] [update:${changes.update.length}], [create:${changes.create.length}]`
    );

    await super.processChanges(assets, changes);
  }
}
