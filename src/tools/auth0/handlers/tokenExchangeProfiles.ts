import { Management } from 'auth0';
import DefaultHandler, { order } from './default';
import { Asset, Assets } from '../../../types';
import { paginate } from '../client';
import log from '../../../logger';

// Define TokenExchangeProfile type
export type TokenExchangeProfile = Management.TokenExchangeProfileResponseContent;

export const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the token exchange profile',
      },
      id: {
        type: 'string',
        description: 'The unique identifier of the token exchange profile',
      },
      subject_token_type: {
        type: 'string',
        description: 'The URI representing the subject token type',
      },
      action: {
        type: 'string',
        description: 'The name of the action associated with this profile',
      },
      type: {
        type: 'string',
        enum: ['custom_authentication'],
        description: 'The type of token exchange profile',
      },
      created_at: {
        type: 'string',
        format: 'date-time',
        description: 'The timestamp when the profile was created',
      },
      updated_at: {
        type: 'string',
        format: 'date-time',
        description: 'The timestamp when the profile was last updated',
      },
    },
    required: ['name', 'subject_token_type', 'action', 'type'],
  },
};

export default class TokenExchangeProfilesHandler extends DefaultHandler {
  existing: TokenExchangeProfile[];

  private actions: Asset[] | null;

  constructor(config: DefaultHandler) {
    super({
      ...config,
      type: 'tokenExchangeProfiles',
      id: 'id',
      identifiers: ['id', 'name'],
      // Only name and subject_token_type can be updated
      stripUpdateFields: ['id', 'created_at', 'updated_at', 'action_id', 'type'],
      stripCreateFields: ['id', 'created_at', 'updated_at'],
    });
  }

  private sanitizeForExport(profile: TokenExchangeProfile, actions: Asset[]): TokenExchangeProfile {
    if (profile.action_id) {
      const action = actions?.find((a) => a.id === profile.action_id);
      if (action) {
        const { action_id, ...rest } = profile;
        return { ...rest, action: action.name };
      } else {
        log.warn(
          `Token exchange profile "${profile.name}" references action with ID "${profile.action_id}" which was not found`
        );
      }
    }
    return profile;
  }

  private sanitizeForAPI(profile: TokenExchangeProfile, actions: Asset[]): TokenExchangeProfile {
    if (profile.action) {
      const foundAction = actions?.find((a) => a.name === profile.action);
      if (foundAction) {
        const { action, ...rest } = profile;
        return { ...rest, action_id: foundAction.id };
      } else {
        throw new Error(
          `Token exchange profile "${profile.name}" references action "${profile.action}" which was not found`
        );
      }
    }

    if (!profile.action_id) {
      throw new Error(
        `Token exchange profile "${profile.name}" is missing action reference. ` +
          `Expected "action" (name) or "action_id" (ID) field.`
      );
    }

    return profile;
  }

  async getActions(): Promise<Asset[]> {
    if (this.actions) return this.actions;

    this.actions = await paginate<Asset>(this.client.actions.list, {
      paginate: true,
    });

    return this.actions;
  }

  async getType(): Promise<TokenExchangeProfile[]> {
    if (this.existing) return this.existing;

    try {
      // Fetch all token exchange profiles
      const profiles = await paginate<TokenExchangeProfile>(
        this.client.tokenExchangeProfiles.list,
        {
          paginate: true,
        }
      );

      // Fetch all actions to map action_id to action name
      const actions = await this.getActions();

      // Map action_id to action name for each profile
      this.existing = profiles.map((profile) => this.sanitizeForExport(profile, actions));

      return this.existing;
    } catch (err) {
      if (err.statusCode === 403) {
        log.warn(
          'Token Exchange Profiles feature is not available on this tenant. Please contact Auth0 support to enable this feature.'
        );
        return [];
      }
      throw err;
    }
  }

  @order('65')
  async processChanges(assets: Assets): Promise<void> {
    const { tokenExchangeProfiles } = assets;

    // Do nothing if not set
    if (!tokenExchangeProfiles) return;

    // Fetch actions to resolve action names to IDs
    const actions = await this.getActions();

    // Map action names to action_ids before processing
    const sanitizedProfiles = tokenExchangeProfiles.map((profile) =>
      this.sanitizeForAPI(profile as TokenExchangeProfile, actions)
    );

    // Create modified assets with sanitized profiles
    const modifiedAssets = {
      ...assets,
      tokenExchangeProfiles: sanitizedProfiles as TokenExchangeProfile[],
    };

    // Calculate changes
    const { del, update, create, conflicts } = await this.calcChanges(modifiedAssets);

    log.debug(
      `Start processChanges for tokenExchangeProfiles [delete:${del.length}] [update:${update.length}], [create:${create.length}], [conflicts:${conflicts.length}]`
    );

    // Process changes in order: delete, create, update
    if (del.length > 0) {
      await this.deleteTokenExchangeProfiles(del);
    }

    if (create.length > 0) {
      await this.createTokenExchangeProfiles(create);
    }

    if (update.length > 0) {
      await this.updateTokenExchangeProfiles(update);
    }
  }

  async createTokenExchangeProfile(profile: TokenExchangeProfile): Promise<TokenExchangeProfile> {
    const { id, created_at, updated_at, ...createParams } = profile;
    const created = await this.client.tokenExchangeProfiles.create(
      createParams as Management.CreateTokenExchangeProfileRequestContent
    );
    return created;
  }

  async createTokenExchangeProfiles(creates: TokenExchangeProfile[]): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item: TokenExchangeProfile) =>
          this.createTokenExchangeProfile(item)
            .then((data) => {
              this.didCreate(data);
              this.created += 1;
            })
            .catch((err) => {
              throw new Error(`Problem creating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async updateTokenExchangeProfile(profile: TokenExchangeProfile): Promise<void> {
    const { id, created_at, updated_at, action_id, type, ...updateParams } = profile;

    if (!id) {
      throw new Error(`Cannot update token exchange profile "${profile.name}" - missing id`);
    }

    await this.client.tokenExchangeProfiles.update(id, updateParams);
  }

  async updateTokenExchangeProfiles(updates: TokenExchangeProfile[]): Promise<void> {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item: TokenExchangeProfile) =>
          this.updateTokenExchangeProfile(item)
            .then(() => {
              this.didUpdate(item);
              this.updated += 1;
            })
            .catch((err) => {
              throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async deleteTokenExchangeProfile(profile: TokenExchangeProfile): Promise<void> {
    if (!profile.id) {
      throw new Error(`Cannot delete token exchange profile "${profile.name}" - missing id`);
    }

    await this.client.tokenExchangeProfiles.delete(profile.id);
  }

  async deleteTokenExchangeProfiles(data: TokenExchangeProfile[]): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: data || [],
          generator: (item: TokenExchangeProfile) =>
            this.deleteTokenExchangeProfile(item)
              .then(() => {
                this.didDelete(item);
                this.deleted += 1;
              })
              .catch((err) => {
                throw new Error(`Problem deleting ${this.type} ${this.objString(item)}\n${err}`);
              }),
        })
        .promise();
    } else {
      log.warn(`Detected the following tokenExchangeProfile should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
      \n${data.map((i) => this.objString(i)).join('\n')}`);
    }
  }
}
