import { Management } from 'auth0';
import { isEmpty } from 'lodash';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import log from '../../../logger';
import DefaultAPIHandler from './default';
import { calculateChanges } from '../../calculateChanges';
import { paginate } from '../client';

enum SelfServiceProfileCustomTextLanguageEnum {
  en = 'en',
}

enum SelfServiceProfileCustomTextPageEnum {
  getStarted = 'get-started',
}

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

  async processChanges(assets: Assets): Promise<void> {
    const { selfServiceProfiles } = assets;

    // Do nothing if not set
    if (!selfServiceProfiles) return;

    // Gets SsProfileWithCustomText from destination tenant
    const existing = await this.getType();

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
          ...customText[SelfServiceProfileCustomTextLanguageEnum.en][
            SelfServiceProfileCustomTextPageEnum.getStarted
          ] as Record<string, string>,
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
    const created = await this.client.selfServiceProfiles.create(ssProfile as Management.CreateSelfServiceProfileRequestContent);

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
}
