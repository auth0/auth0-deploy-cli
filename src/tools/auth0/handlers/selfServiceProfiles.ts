import { Management } from 'auth0';
import { isEmpty } from 'lodash';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import log from '../../../logger';
import DefaultAPIHandler, { order } from './default';
import { calculateChanges } from '../../calculateChanges';
import { paginate } from '../client';
import { UserAttributeProfile } from './userAttributeProfiles';

const SelfServiceProfileCustomTextLanguageEnum = {
  en: 'en',
} as const;

const SelfServiceProfileCustomTextPageEnum = {
  getStarted: 'get-started',
} as const;

type customTextType = {
  [SelfServiceProfileCustomTextLanguageEnum.en]: {
    [SelfServiceProfileCustomTextPageEnum.getStarted]: Object;
  };
};

type SsProfile = Management.SelfServiceProfile;

export type SsProfileWithCustomText = Omit<SsProfile, 'created_at' | 'updated_at'> & {
  customText?: customTextType;
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
      description: {
        type: 'string',
      },
      user_attributes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            is_optional: {
              type: 'boolean',
            },
          },
        },
      },
      branding: {
        type: 'object',
        properties: {
          logo_url: {
            type: 'string',
          },
          colors: {
            type: 'object',
            properties: {
              primary: {
                type: 'string',
              },
            },
            required: ['primary'],
          },
        },
      },
      customText: {
        type: 'object',
        properties: {
          [SelfServiceProfileCustomTextLanguageEnum.en]: {
            type: 'object',
            properties: {
              [SelfServiceProfileCustomTextPageEnum.getStarted]: {
                type: 'object',
              },
            },
          },
        },
      },
      user_attribute_profile_id: {
        type: 'string',
      },
    },
    required: ['name'],
  },
};

export default class SelfServiceProfileHandler extends DefaultAPIHandler {
  existing: SsProfileWithCustomText[];

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'selfServiceProfiles',
      id: 'id',
      stripCreateFields: ['created_at', 'updated_at'],
      stripUpdateFields: ['created_at', 'updated_at'],
    });
  }

  async getType() {
    if (this.existing) return this.existing;

    const selfServiceProfiles = await paginate<SsProfile>(this.client.selfServiceProfiles.list, {
      paginate: true,
    });

    const selfServiceProfileWithCustomText: SsProfileWithCustomText[] = await Promise.all(
      selfServiceProfiles.map(async (sp) => {
        /**
         * Fetches the custom text for the "get_started" in "en" page of a self-service profile.
         */

        const { data: getStartedText } = await this.client.selfServiceProfiles.customText.list(
          sp.id as string,
          SelfServiceProfileCustomTextLanguageEnum.en,
          SelfServiceProfileCustomTextPageEnum.getStarted
        );

        if (!isEmpty(getStartedText)) {
          const customText = {
            [SelfServiceProfileCustomTextLanguageEnum.en]: {
              [SelfServiceProfileCustomTextPageEnum.getStarted]: getStartedText,
            },
          };
          return {
            ...sp,
            customText,
          };
        }

        return sp;
      })
    );

    this.existing = selfServiceProfileWithCustomText;
    return this.existing;
  }

  // Run after UserAttributeProfiles so that we can handle converting any `user_attribute_profile_id` names to IDs
  @order('60')
  async processChanges(assets: Assets): Promise<void> {
    let { selfServiceProfiles } = assets;

    // Do nothing if not set
    if (!selfServiceProfiles) return;

    // Gets SsProfileWithCustomText from destination tenant
    const existing = await this.getType();

    const userAttributeProfiles = await this.getUserAttributeProfiles(selfServiceProfiles);

    selfServiceProfiles = selfServiceProfiles.map((ssProfile) => {
      if (this.hasConflictingUserAttribute(ssProfile)) {
        log.error(
          `Self Service Profile ${ssProfile.name} has conflicting properties user_attribute_profile_id and user_attributes. Please remove one.`
        );
        throw new Error(
          `Self Service Profile ${ssProfile.name} has conflicting properties user_attribute_profile_id and user_attributes. Please remove one.`
        );
      }

      // don't process if no user_attribute_profile_id
      if (!ssProfile.user_attribute_profile_id) return ssProfile;
      const profile = { ...ssProfile };

      const found = userAttributeProfiles.find(
        (uap) => uap.name === profile.user_attribute_profile_id
      );
      if (found) {
        profile.user_attribute_profile_id = found.id;
      } else {
        log.error(
          `User Attribute ${profile.user_attribute_profile_id} not found for Self Service Profile ${profile.name}. Please verify the User Attribute Profile Name.`
        );
        throw new Error(
          `User Attribute ${profile.user_attribute_profile_id} not found for Self Service Profile ${profile.name}. Please verify the User Attribute Profile Name.`
        );
      }
      return profile;
    });

    const changes = calculateChanges({
      handler: this,
      assets: selfServiceProfiles,
      existing,
      identifiers: this.identifiers,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });

    log.debug(
      `Start processChanges for selfServiceProfiles [delete:${changes.del.length}] [update:${changes.update.length}], [create:${changes.create.length}]`
    );

    const myChanges = [
      { del: changes.del },
      { create: changes.create },
      { update: changes.update },
    ];

    await Promise.all(
      myChanges.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            await this.deleteSelfServiceProfiles(change.del || []);
            break;
          case change.create && change.create.length > 0:
            await this.createSelfServiceProfiles(changes.create);
            break;
          case change.update && change.update.length > 0:
            if (change.update) await this.updateSelfServiceProfiles(change.update);
            break;
          default:
            break;
        }
      })
    );
  }

  async updateCustomText(ssProfileId: string, customText: customTextType): Promise<void> {
    try {
      await this.client.selfServiceProfiles.customText.set(
        ssProfileId,
        SelfServiceProfileCustomTextLanguageEnum.en,
        SelfServiceProfileCustomTextPageEnum.getStarted,
        {
          ...(customText[SelfServiceProfileCustomTextLanguageEnum.en][
            SelfServiceProfileCustomTextPageEnum.getStarted
          ] as Record<string, string>),
        }
      );
      log.debug(`Updated custom text for ${this.type} ${ssProfileId}`);
    } catch (err) {
      log.error(`Problem updating custom text for ${this.type} ${ssProfileId}\n${err}`);
      throw new Error(`Problem updating custom text for ${this.type} ${ssProfileId}\n${err}`);
    }
  }

  async createSelfServiceProfiles(creates: CalculatedChanges['create']) {
    await this.client.pool
      .addEachTask({
        data: creates || [],
        generator: (item: SsProfileWithCustomText) =>
          this.createSelfServiceProfile(item)
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

  async createSelfServiceProfile(profile: SsProfileWithCustomText): Promise<Asset> {
    const { customText, ...ssProfile } = profile;
    const created = await this.client.selfServiceProfiles.create(
      ssProfile as Management.CreateSelfServiceProfileRequestContent
    );

    if (!isEmpty(customText) && created.id) {
      await this.updateCustomText(created.id, customText);
    }

    return created;
  }

  async updateSelfServiceProfiles(updates: CalculatedChanges['update']) {
    await this.client.pool
      .addEachTask({
        data: updates || [],
        generator: (item: SsProfileWithCustomText) =>
          this.updateSelfServiceProfile(item)
            .then((data) => {
              this.didUpdate(data);
              this.updated += 1;
            })
            .catch((err) => {
              throw new Error(`Problem updating ${this.type} ${this.objString(item)}\n${err}`);
            }),
      })
      .promise();
  }

  async updateSelfServiceProfile(profile: SsProfileWithCustomText): Promise<Asset> {
    const { customText, id, ...ssProfile } = profile;
    const updated = await this.client.selfServiceProfiles.update(id as string, ssProfile);

    if (!isEmpty(customText) && updated.id) {
      await this.updateCustomText(updated.id, customText);
    }
    return updated;
  }

  async deleteSelfServiceProfiles(deletes: CalculatedChanges['del']): Promise<void> {
    if (
      this.config('AUTH0_ALLOW_DELETE') === 'true' ||
      this.config('AUTH0_ALLOW_DELETE') === true
    ) {
      await this.client.pool
        .addEachTask({
          data: deletes || [],
          generator: (item: SsProfileWithCustomText) =>
            this.deleteSelfServiceProfile(item)
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
      log.warn(`Detected the following selfServiceProfile should be deleted. Doing so may be destructive.\nYou can enable deletes by setting 'AUTH0_ALLOW_DELETE' to true in the config
            \n${deletes.map((i) => this.objString(i)).join('\n')}`);
    }
  }

  async deleteSelfServiceProfile(profile: SsProfileWithCustomText): Promise<void> {
    await this.client.selfServiceProfiles.delete(profile.id as string);
  }

  async getUserAttributeProfiles(
    selfServiceProfiles: SsProfileWithCustomText[]
  ): Promise<UserAttributeProfile[]> {
    if (
      selfServiceProfiles.some(
        (p) => p.user_attribute_profile_id && p.user_attribute_profile_id.trim() !== ''
      )
    ) {
      return paginate<UserAttributeProfile>(this.client.userAttributeProfiles.list, {
        checkpoint: true,
        include_totals: true,
        is_global: false,
        take: 10,
      });
    }

    return [];
  }

  hasConflictingUserAttribute(profile: SsProfileWithCustomText): boolean {
    // If both user_attribute_profile_id and user_attributes are set and have values then error
    if (
      profile.user_attribute_profile_id &&
      profile.user_attribute_profile_id.trim() !== '' &&
      profile.user_attributes &&
      profile.user_attributes.length > 0
    ) {
      return true;
    }
    return false;
  }
}
