import { SsProfile } from 'auth0';
import { Assets } from '../../../types';
import log from '../../../logger';
import DefaultAPIHandler from './default';
import { calculateChanges } from '../../calculateChanges';

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
              type: 'boolean',
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
    },
    required: ['name'],
  },
};

export default class SelfServiceProfileHandler extends DefaultAPIHandler {
  existing: SsProfile[];

  constructor(config: DefaultAPIHandler) {
    super({
      ...config,
      type: 'selfServiceProfiles',
      id: 'id',
    });
  }

  async processChanges(assets: Assets): Promise<void> {
    const { selfServiceProfiles } = assets;

    // Do nothing if not set
    if (!selfServiceProfiles) return;

    const existing = await this.getType();

    const changes = calculateChanges({
      handler: this,
      assets: selfServiceProfiles,
      existing,
      identifiers: this.identifiers,
      allowDelete: !!this.config('AUTH0_ALLOW_DELETE'),
    });

    log.debug(
      `Start processChanges for organizations [delete:${changes.del.length}] [update:${changes.update.length}], [create:${changes.create.length}]`
    );

    const myChanges = [
      { del: changes.del },
      { create: changes.create },
      { update: changes.update },
    ];

    console.log('CLOG: myChanges', myChanges);

    /*
    await Promise.all(
      myChanges.map(async (change) => {
        switch (true) {
          case change.del && change.del.length > 0:
            await this.client.selfServiceProfiles.deleteSelfServiceProfiles(change.del || []);
            break;
          case change.create && change.create.length > 0:
            await this.client.selfServiceProfiles.postSelfServiceProfiles(changes.create);
            break;
          case change.update && change.update.length > 0:
            if (change.update) await this.client.selfServiceProfiles.patchSelfServiceProfiles(change.update, existing);
            break;
          default:
            break;
        }
      })
    );
    */
  }

  async getType() {
    if (this.existing) return this.existing;

    const { data: selfServiceProfiles } =
      await this.client.selfServiceProfiles.getAll();

    this.existing = selfServiceProfiles;
    return this.existing;
  }
}
