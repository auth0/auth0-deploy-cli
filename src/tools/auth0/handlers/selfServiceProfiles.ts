import {
  GetSelfServiceProfileCustomTextLanguageEnum,
  GetSelfServiceProfileCustomTextPageEnum,
  SsProfile,
} from 'auth0';
import { isEmpty } from 'lodash';
import { Asset, Assets, CalculatedChanges } from '../../../types';
import log from '../../../logger';
import DefaultAPIHandler from './default';
import { paginate } from '../client';
import { isDryRun } from '../../utils';

type customTextType = {
  [GetSelfServiceProfileCustomTextLanguageEnum.en]: {
    [GetSelfServiceProfileCustomTextPageEnum.get_started]: Object;
  };
};

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
          [GetSelfServiceProfileCustomTextLanguageEnum.en]: {
            type: 'object',
            properties: {
              [GetSelfServiceProfileCustomTextPageEnum.get_started]: {
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

    const selfServiceProfiles = await paginate<SsProfile>(this.client.selfServiceProfiles.getAll, {
      paginate: true,
      include_totals: true,
      is_global: false,
    });

    const selfServiceProfileWithCustomText: SsProfileWithCustomText[] = await Promise.all(
      selfServiceProfiles.map(async (sp) => {
        /**
         * Fetches the custom text for the "get_started" in "en" page of a self-service profile.
         */
        const { data: getStartedText } = await this.client.selfServiceProfiles.getCustomText({
          id: sp.id,
          language: GetSelfServiceProfileCustomTextLanguageEnum.en,
          page: GetSelfServiceProfileCustomTextPageEnum.get_started,
        });

        if (!isEmpty(getStartedText)) {
          const customText = {
            [GetSelfServiceProfileCustomTextLanguageEnum.en]: {
              [GetSelfServiceProfileCustomTextPageEnum.get_started]: getStartedText,
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

    const { del, update, create } = await this.calcChanges(assets);

    if (isDryRun(this.config)) {
      if (create.length === 0 && update.length === 0 && del.length === 0) {
        return;
      }
    }

    const myChanges = [{ del: del }, { create: create }, { update: update }];

    await Promise.all(
      myChanges.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            await this.deleteSelfServiceProfiles(change.del || []);
            break;
          case change.create && change.create.length > 0:
            await this.createSelfServiceProfiles(change.create);
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
      await this.client.selfServiceProfiles.updateCustomText(
        {
          id: ssProfileId,
          language: GetSelfServiceProfileCustomTextLanguageEnum.en,
          page: GetSelfServiceProfileCustomTextPageEnum.get_started,
        },
        {
          ...customText[GetSelfServiceProfileCustomTextLanguageEnum.en][
            GetSelfServiceProfileCustomTextPageEnum.get_started
          ],
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
    const { data: created } = await this.client.selfServiceProfiles.create(ssProfile as SsProfile);

    if (!isEmpty(customText)) {
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
    const { data: updated } = await this.client.selfServiceProfiles.update({ id }, ssProfile);

    if (!isEmpty(customText)) {
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
    await this.client.selfServiceProfiles.delete({ id: profile.id });
  }
}
